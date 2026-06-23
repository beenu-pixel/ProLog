import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

// POST /api/billing/portal — tworzy sesję portalu Stripe (zarządzanie subskrypcją:
// zmiana karty, anulowanie) dla zalogowanego użytkownika i zwraca URL. Wymaga
// powiązanego klienta Stripe (provider_customer_id z wcześniejszego zakupu).
//
// ⚠️ W trybie test portal wymaga jednorazowej aktywacji konfiguracji w panelu
// Stripe (Settings → Billing → Customer portal), inaczej Stripe zwróci błąd.

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  if (!isStripeConfigured || !stripe || !supabaseAdmin) {
    return Response.json(
      { error: "Płatności nieskonfigurowane." },
      { status: 503 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  const customerId = data?.provider_customer_id as string | undefined;
  if (error || !customerId) {
    return Response.json(
      { error: "Brak aktywnej subskrypcji do zarządzania." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings`,
    });
    return Response.json({ url: portal.url });
  } catch (err) {
    console.error("[billing/portal] create session nieudany:", err);
    return Response.json(
      { error: "Nie udało się otworzyć portalu subskrypcji." },
      { status: 502 }
    );
  }
}
