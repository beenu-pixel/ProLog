import { describe, expect, it } from "vitest";

import { normalizeSearchLimits } from "@/lib/services/search";

// Granice zapytania chronią bazę przed ogromnym match_count / szerokim oknem dat
// podanym w ciele żądania /api/search.
describe("normalizeSearchLimits", () => {
  it("używa wartości domyślnych, gdy brak opcji", () => {
    expect(normalizeSearchLimits()).toEqual({ limit: 30, recentDays: 7 });
    expect(normalizeSearchLimits({})).toEqual({ limit: 30, recentDays: 7 });
  });

  it("przepuszcza wartości w dozwolonym zakresie", () => {
    expect(normalizeSearchLimits({ limit: 10, recentDays: 14 })).toEqual({
      limit: 10,
      recentDays: 14,
    });
  });

  it("przycina wartości powyżej sufitu (anty-nadużycie)", () => {
    expect(normalizeSearchLimits({ limit: 10_000_000, recentDays: 100_000 })).toEqual({
      limit: 100,
      recentDays: 90,
    });
  });

  it("podnosi wartości poniżej minimum do 1", () => {
    expect(normalizeSearchLimits({ limit: 0, recentDays: -5 })).toEqual({
      limit: 1,
      recentDays: 1,
    });
  });

  it("obcina ułamki i odrzuca wartości niebędące skończoną liczbą", () => {
    expect(normalizeSearchLimits({ limit: 12.9 }).limit).toBe(12);
    expect(normalizeSearchLimits({ limit: NaN }).limit).toBe(30);
    expect(normalizeSearchLimits({ recentDays: Infinity }).recentDays).toBe(7);
  });
});
