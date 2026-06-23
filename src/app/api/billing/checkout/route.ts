import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import {
  priceIdFor,
  type BillingPeriod,
  type PaidTier,
} from "@/lib/stripe-prices";

// POST /api/billing/checkout — tworzy SERWEROWO sesję Stripe Checkout dla
// zalogowanego użytkownika i zwraca URL do przekierowania. Body:
//   { plan: "pro" | "max", period: "monthly" | "yearly" }
//
// KLUCZOWE dla bezpieczeństwa: `client_reference_id` (i metadata) ustawiamy z
// userId pochodzącego z ZWERYFIKOWANEJ sesji JWT — nie z wejścia klienta. Dzięki
// temu nie da się opłacić planu na cudze/obce konto przez podmianę parametru w URL
// (czego nie gwarantował poprzedni model ze statycznymi Payment Linkami).
//
// node:crypto w warstwie auth wymaga runtime Node (nie Edge).
export const runtime = "nodejs";

interface CheckoutRequest {
  plan?: string;
  period?: string;
}

const PAID_TIERS: readonly PaidTier[] = ["pro", "max"] as const;
const PERIODS: readonly BillingPeriod[] = ["monthly", "yearly"] as const;

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  if (!isStripeConfigured || !stripe) {
    return Response.json({ error: "Płatności nieskonfigurowane." }, { status: 503 });
  }

  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return Response.json({ error: "Niepoprawne ciało żądania." }, { status: 400 });
  }

  if (!PAID_TIERS.includes(body.plan as PaidTier)) {
    return Response.json(
      { error: "Pole `plan` musi być 'pro' albo 'max'." },
      { status: 400 }
    );
  }
  if (!PERIODS.includes(body.period as BillingPeriod)) {
    return Response.json(
      { error: "Pole `period` musi być 'monthly' albo 'yearly'." },
      { status: 400 }
    );
  }
  // Po walidacji wiemy, że wartości są poprawne — zawężamy typy (includes ich nie zwęża).
  const plan = body.plan as PaidTier;
  const period = body.period as BillingPeriod;

  const priceId = priceIdFor(plan, period);
  if (!priceId) {
    return Response.json(
      { error: "Wybrany plan jest chwilowo niedostępny." },
      { status: 503 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // userId z zweryfikowanej sesji — webhook odczyta go z client_reference_id.
      client_reference_id: auth.userId,
      customer_email: auth.email ?? undefined,
      // Plan + user trafiają też do metadata sesji i subskrypcji — webhook ustala
      // tier w pierwszej kolejności z metadata (najpewniejsze źródło).
      metadata: { user_id: auth.userId, tier: plan },
      subscription_data: { metadata: { user_id: auth.userId, tier: plan } },
      success_url: `${appUrl}/settings?upgraded=1`,
      cancel_url: `${appUrl}/pricing`,
    });

    if (!session.url) {
      return Response.json(
        { error: "Nie udało się utworzyć sesji płatności." },
        { status: 502 }
      );
    }
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout] create session nieudany:", err);
    return Response.json(
      { error: "Nie udało się rozpocząć płatności." },
      { status: 502 }
    );
  }
}
