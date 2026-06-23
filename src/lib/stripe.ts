import Stripe from "stripe";

// Serwerowy klient Stripe — TYLKO po stronie serwera (webhook płatności).
// Klucz `STRIPE_SECRET_KEY` (sk_test_… w sandboxie / sk_live_… na produkcji) jest
// zmienną SERWEROWĄ — nigdy w przeglądarce. `null`, gdy brak konfiguracji
// (webhook zwraca wtedy 503). Wersję API zostawiamy domyślną dla konta.

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

export const stripe: Stripe | null = secretKey ? new Stripe(secretKey) : null;

/** Czy Stripe jest skonfigurowany (jest klucz sekretny). */
export const isStripeConfigured = Boolean(stripe);
