import type { PlanTier } from "@/lib/plans";

// Mapowanie Stripe Price ID ↔ plan — JEDNO źródło prawdy do tworzenia sesji
// Checkout (tier+okres → priceId) oraz do webhooka (priceId → tier). Identyfikatory
// cen trzymamy w zmiennych SERWEROWYCH (nie `NEXT_PUBLIC_`), bo dotyczą tworzenia
// płatności po stronie serwera. Brak danej ceny w env => `null` (endpoint Checkout
// zwróci wtedy 503 — bezpieczna degradacja, nigdy nie zgadujemy planu).
//
// Mapujemy po `price_id` zamiast po kwocie (`tierForAmount`), bo kwota końcowa
// potrafi się zmienić przez kupon/promocję — `price_id` jest stabilny.

/** Plany płatne (free nie ma ceny). */
export type PaidTier = Exclude<PlanTier, "free">;

/** Okres rozliczeniowy płatności. */
export type BillingPeriod = "monthly" | "yearly";

/** Źródło zmiennych środowiskowych (wstrzykiwalne → testowalne bez globalnego process.env). */
export type EnvSource = Record<string, string | undefined>;

/** Nazwa zmiennej env z Price ID dla danej pary (plan, okres). */
const ENV_KEYS: Record<PaidTier, Record<BillingPeriod, string>> = {
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY",
  },
  max: {
    monthly: "STRIPE_PRICE_MAX_MONTHLY",
    yearly: "STRIPE_PRICE_MAX_YEARLY",
  },
};

const PAID_TIERS: readonly PaidTier[] = ["pro", "max"] as const;
const PERIODS: readonly BillingPeriod[] = ["monthly", "yearly"] as const;

/**
 * Stripe Price ID dla planu i okresu (z env). `null`, gdy zmiennej brak lub jest
 * pusta — wołający traktuje to jako „cena nieskonfigurowana" (503).
 */
export function priceIdFor(
  plan: PaidTier,
  period: BillingPeriod,
  env: EnvSource = process.env
): string | null {
  const key = ENV_KEYS[plan]?.[period];
  if (!key) return null;
  const value = env[key]?.trim();
  return value ? value : null;
}

/**
 * Plan odpowiadający danemu Stripe Price ID (odwrotność `priceIdFor`). Przeszukuje
 * skonfigurowane ceny; `null` dla nieznanego/pustego priceId (webhook to wtedy loguje).
 */
export function tierForPriceId(
  priceId: string | null | undefined,
  env: EnvSource = process.env
): PaidTier | null {
  const trimmed = priceId?.trim();
  if (!trimmed) return null;
  for (const tier of PAID_TIERS) {
    for (const period of PERIODS) {
      if (priceIdFor(tier, period, env) === trimmed) return tier;
    }
  }
  return null;
}
