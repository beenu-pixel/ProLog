import { describe, expect, it } from "vitest";

import {
  priceIdFor,
  tierForPriceId,
  type EnvSource,
} from "@/lib/stripe-prices";

// Pełny, poprawny zestaw cen — wstrzykiwany zamiast process.env, by test był
// niezależny od środowiska.
const ENV: EnvSource = {
  STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
  STRIPE_PRICE_PRO_YEARLY: "price_pro_y",
  STRIPE_PRICE_MAX_MONTHLY: "price_max_m",
  STRIPE_PRICE_MAX_YEARLY: "price_max_y",
};

describe("priceIdFor", () => {
  it("mapuje każdą parę (plan, okres) na właściwy Price ID", () => {
    expect(priceIdFor("pro", "monthly", ENV)).toBe("price_pro_m");
    expect(priceIdFor("pro", "yearly", ENV)).toBe("price_pro_y");
    expect(priceIdFor("max", "monthly", ENV)).toBe("price_max_m");
    expect(priceIdFor("max", "yearly", ENV)).toBe("price_max_y");
  });

  it("zwraca null, gdy zmiennej brak lub jest pusta/biała", () => {
    expect(priceIdFor("pro", "monthly", {})).toBeNull();
    expect(priceIdFor("pro", "monthly", { STRIPE_PRICE_PRO_MONTHLY: "" })).toBeNull();
    expect(priceIdFor("pro", "monthly", { STRIPE_PRICE_PRO_MONTHLY: "   " })).toBeNull();
  });
});

describe("tierForPriceId", () => {
  it("odwraca mapowanie — Price ID → plan", () => {
    expect(tierForPriceId("price_pro_m", ENV)).toBe("pro");
    expect(tierForPriceId("price_pro_y", ENV)).toBe("pro");
    expect(tierForPriceId("price_max_m", ENV)).toBe("max");
    expect(tierForPriceId("price_max_y", ENV)).toBe("max");
  });

  it("zwraca null dla nieznanego / pustego / brakującego priceId", () => {
    expect(tierForPriceId("price_obcy", ENV)).toBeNull();
    expect(tierForPriceId("", ENV)).toBeNull();
    expect(tierForPriceId(null, ENV)).toBeNull();
    expect(tierForPriceId(undefined, ENV)).toBeNull();
  });

  it("ignoruje ceny nieskonfigurowane w env (nie myli się przy częściowej konfiguracji)", () => {
    const partial: EnvSource = { STRIPE_PRICE_PRO_MONTHLY: "price_pro_m" };
    expect(tierForPriceId("price_pro_m", partial)).toBe("pro");
    // max niezdefiniowane → jego dawne id nie mapuje się na nic
    expect(tierForPriceId("price_max_m", partial)).toBeNull();
  });
});
