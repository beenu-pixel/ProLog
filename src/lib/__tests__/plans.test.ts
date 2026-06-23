import { describe, expect, it } from "vitest";

import {
  bucketLimit,
  dailyCountBuckets,
  isPersonaAllowed,
  ragDepth,
  reportsAccess,
  isReportPeriodAllowed,
  tierForAmount,
  RATE_BUCKETS,
  PLAN_TIERS,
  type PlanTier,
} from "@/lib/plans";

describe("PLAN_TIERS", () => {
  it("zawiera trzy plany w kolejności rosnącej", () => {
    expect(PLAN_TIERS).toEqual(["free", "pro", "max"]);
  });
});

describe("bucketLimit", () => {
  it("free dostaje 5 rozmów z personą dziennie (quota produktowa)", () => {
    expect(bucketLimit("free", "therapist").perDay).toBe(5);
  });

  it("limity dzienne rosną z planem dla każdego kubełka", () => {
    for (const bucket of RATE_BUCKETS) {
      const free = bucketLimit("free", bucket).perDay;
      const pro = bucketLimit("pro", bucket).perDay;
      const max = bucketLimit("max", bucket).perDay;
      expect(pro).toBeGreaterThanOrEqual(free);
      expect(max).toBeGreaterThanOrEqual(pro);
    }
  });

  it("definiuje limit dla każdej pary (plan, kubełek)", () => {
    for (const tier of PLAN_TIERS) {
      for (const bucket of RATE_BUCKETS) {
        const limit = bucketLimit(tier, bucket);
        expect(limit.perMinute).toBeGreaterThan(0);
        expect(limit.perDay).toBeGreaterThan(0);
      }
    }
  });
});

describe("dailyCountBuckets — wspólna pula", () => {
  it("free liczy czat i ask_agent RAZEM (wspólna pula 5)", () => {
    expect(dailyCountBuckets("free", "therapist").sort()).toEqual([
      "api_agent",
      "therapist",
    ]);
    expect(dailyCountBuckets("free", "api_agent").sort()).toEqual([
      "api_agent",
      "therapist",
    ]);
    // Wspólna pula => oba kubełki mają ten sam dzienny limit.
    expect(bucketLimit("free", "therapist").perDay).toBe(
      bucketLimit("free", "api_agent").perDay
    );
  });

  it("pro/max nie łączą pul — każdy kubełek liczy się sam", () => {
    for (const tier of ["pro", "max"] as PlanTier[]) {
      for (const bucket of RATE_BUCKETS) {
        expect(dailyCountBuckets(tier, bucket)).toEqual([bucket]);
      }
    }
  });

  it("niezgrupowane kubełki na free liczą się osobno", () => {
    expect(dailyCountBuckets("free", "transcribe")).toEqual(["transcribe"]);
    expect(dailyCountBuckets("free", "search")).toEqual(["search"]);
    expect(dailyCountBuckets("free", "api_data")).toEqual(["api_data"]);
  });
});

describe("isPersonaAllowed", () => {
  it("free ma tylko Freuda", () => {
    expect(isPersonaAllowed("free", "freud")).toBe(true);
    expect(isPersonaAllowed("free", "jung")).toBe(false);
    expect(isPersonaAllowed("free", "marek-aureliusz")).toBe(false);
  });

  it("pro i max mają wszystkie persony", () => {
    for (const tier of ["pro", "max"] as PlanTier[]) {
      expect(isPersonaAllowed(tier, "freud")).toBe(true);
      expect(isPersonaAllowed(tier, "jung")).toBe(true);
      expect(isPersonaAllowed(tier, "marinoff")).toBe(true);
    }
  });
});

describe("ragDepth", () => {
  it("free dostaje płytki kontekst, pro/max pełny", () => {
    const free = ragDepth("free");
    const pro = ragDepth("pro");
    expect(free.recentDays).toBeLessThan(pro.recentDays);
    expect(free.limit).toBeLessThan(pro.limit);
    expect(ragDepth("max")).toEqual(pro);
  });
});

describe("reportsAccess", () => {
  it("free bez raportów, pro tygodniowe, max + miesięczne", () => {
    expect(reportsAccess("free")).toBe("none");
    expect(reportsAccess("pro")).toBe("weekly");
    expect(reportsAccess("max")).toBe("weekly+monthly");
  });
});

describe("isReportPeriodAllowed", () => {
  it("free nie ma żadnych raportów", () => {
    expect(isReportPeriodAllowed("free", "week")).toBe(false);
    expect(isReportPeriodAllowed("free", "month")).toBe(false);
  });

  it("pro ma tylko tygodniowy", () => {
    expect(isReportPeriodAllowed("pro", "week")).toBe(true);
    expect(isReportPeriodAllowed("pro", "month")).toBe(false);
  });

  it("max ma tygodniowy i miesięczny", () => {
    expect(isReportPeriodAllowed("max", "week")).toBe(true);
    expect(isReportPeriodAllowed("max", "month")).toBe(true);
  });
});

describe("tierForAmount — mapowanie płatności Stripe", () => {
  it("39 zł / 390 zł → pro (miesięczny i roczny)", () => {
    expect(tierForAmount(3900)).toBe("pro");
    expect(tierForAmount(39000)).toBe("pro");
  });

  it("79 zł / 790 zł → max (miesięczny i roczny)", () => {
    expect(tierForAmount(7900)).toBe("max");
    expect(tierForAmount(79000)).toBe("max");
  });

  it("nieznana kwota / brak → null (webhook zignoruje)", () => {
    expect(tierForAmount(1234)).toBeNull();
    expect(tierForAmount(0)).toBeNull();
    expect(tierForAmount(null)).toBeNull();
    expect(tierForAmount(undefined)).toBeNull();
  });
});
