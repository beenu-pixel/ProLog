import type Stripe from "stripe";

import { stripe, isStripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { tierForAmount } from "@/lib/plans";

// Webhook Stripe — JEDYNE źródło prawdy o planie użytkownika. Stripe woła ten
// endpoint po zdarzeniach subskrypcji; my weryfikujemy podpis i zapisujemy plan do
// public.subscriptions kluczem sekretnym (omija RLS). UI nigdy nie ustawia planu sama.
//
// node:crypto w weryfikacji podpisu wymaga runtime Node (nie Edge).
export const runtime = "nodejs";

/** Mapuje status subskrypcji Stripe na nasz (zgodny z CHECK w tabeli subscriptions). */
function mapStatus(status: Stripe.Subscription.Status): string {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "incomplete" || status === "incomplete_expired") return "incomplete";
  return "canceled"; // canceled, paused, itp.
}

export async function POST(request: Request): Promise<Response> {
  if (!isStripeConfigured || !stripe || !supabaseAdmin) {
    return Response.json(
      { error: "Płatności nieskonfigurowane (brak STRIPE_SECRET_KEY lub klucza serwera)." },
      { status: 503 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return Response.json({ error: "Brak STRIPE_WEBHOOK_SECRET." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Brak nagłówka stripe-signature." }, { status: 400 });
  }

  // Surowe body (NIE request.json()) — inaczej weryfikacja podpisu się nie zgodzi.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[billing/webhook] weryfikacja podpisu nieudana:", err);
    return Response.json({ error: "Niepoprawny podpis." }, { status: 400 });
  }

  try {
    switch (event.type) {
      // Zakup zakończony — odblokuj plan dla konta z client_reference_id.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const tier = tierForAmount(session.amount_total);

        if (!userId) {
          console.warn("[billing/webhook] checkout bez client_reference_id — pomijam.");
          break;
        }
        if (!tier) {
          console.warn(
            "[billing/webhook] nieznana kwota:",
            session.amount_total,
            "— nie mapuję na plan."
          );
          break;
        }

        // Dociągnij koniec okresu rozliczeniowego od razu (panel „Plan i płatności"
        // pokazuje datę odnowienia) — bez czekania na późniejsze subscription.updated.
        let currentPeriodEnd: string | null = null;
        if (typeof session.subscription === "string") {
          try {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            const periodEndUnix = sub.items?.data?.[0]?.current_period_end ?? null;
            if (periodEndUnix) {
              currentPeriodEnd = new Date(periodEndUnix * 1000).toISOString();
            }
          } catch (err) {
            console.error("[billing/webhook] retrieve subscription nieudany:", err);
          }
        }

        const { error } = await supabaseAdmin.from("subscriptions").upsert({
          user_id: userId,
          tier,
          status: "active",
          provider: "stripe",
          provider_customer_id:
            typeof session.customer === "string" ? session.customer : null,
          provider_subscription_id:
            typeof session.subscription === "string" ? session.subscription : null,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error("[billing/webhook] upsert subscriptions nieudany:", error);
          return Response.json({ error: "Zapis planu nieudany." }, { status: 500 });
        }
        break;
      }

      // Zmiana subskrypcji (odnowienie, past_due, wznowienie) — aktualizuj status/okres.
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // W nowszym API Stripe `current_period_end` jest na pozycji subskrypcji
        // (items.data[]), nie na samej subskrypcji.
        const periodEndUnix = sub.items?.data?.[0]?.current_period_end ?? null;
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: mapStatus(sub.status),
            current_period_end: periodEndUnix
              ? new Date(periodEndUnix * 1000).toISOString()
              : null,
            // Subskrypcja zaplanowana do anulowania na koniec okresu — panel pokaże
            // „Anulowana — dostęp do <data>" zamiast „Odnawia się <data>".
            cancel_at_period_end: Boolean(sub.cancel_at_period_end),
            updated_at: new Date().toISOString(),
          })
          .eq("provider_subscription_id", sub.id);
        break;
      }

      // Anulowanie/wygaśnięcie — plan spada do free (status canceled => getUserPlan zwróci free).
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("provider_subscription_id", sub.id);
        break;
      }

      default:
        // Pozostałe zdarzenia ignorujemy (Stripe i tak uzna 2xx za sukces).
        break;
    }
  } catch (err) {
    console.error("[billing/webhook] błąd obsługi zdarzenia:", err);
    return Response.json({ error: "Błąd obsługi zdarzenia." }, { status: 500 });
  }

  return Response.json({ received: true });
}
