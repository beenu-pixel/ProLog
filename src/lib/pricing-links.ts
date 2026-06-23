// Adresy Payment Linków Stripe per plan i okres. Client-safe (bez importów
// serwerowych) — używane przez przyciski na /pricing. To są linki z SANDBOXA
// (test mode); przy uruchomieniu na żywo podmienić na odpowiedniki z Live.
//
// Do każdego linka doklejamy w UI `?client_reference_id=<userId>`, żeby webhook
// wiedział, KTÓRE konto odblokować po zakupie (patrz src/components/pricing-cta.tsx).

export interface PlanLinks {
  monthly: string;
  yearly: string;
}

export const PAYMENT_LINKS: { pro: PlanLinks; max: PlanLinks } = {
  pro: {
    monthly: "https://buy.stripe.com/test_8x214m8iH2MpctV1jk8Zq00",
    yearly: "https://buy.stripe.com/test_fZu28qcyX1Il3Xp7HI8Zq03",
  },
  max: {
    monthly: "https://buy.stripe.com/test_fZu9AS7eD5YBgKbbXY8Zq01",
    yearly: "https://buy.stripe.com/test_dRm3cudD1aeR3XpaTU8Zq04",
  },
};
