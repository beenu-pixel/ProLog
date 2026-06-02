import { describe, expect, it } from "vitest";

import { buildSeedEntries } from "@/lib/seed";

describe("buildSeedEntries", () => {
  const entries = buildSeedEntries();

  it("tworzy niepustą listę przykładowych wpisów", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it("każdy wpis ma poprawny kształt", () => {
    for (const entry of entries) {
      expect(entry.id).toMatch(/^seed-\d{2}$/);
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.content).toContain("<p>");
      expect(entry.mood).toBeGreaterThanOrEqual(1);
      expect(entry.mood).toBeLessThanOrEqual(5);
      expect(Number.isNaN(new Date(entry.createdAt).getTime())).toBe(false);
    }
  });

  it("identyfikatory są unikalne", () => {
    const ids = new Set(entries.map((e) => e.id));
    expect(ids.size).toBe(entries.length);
  });

  it("wszystkie wpisy są z przeszłości (dziś zostaje puste)", () => {
    const now = Date.now();
    for (const entry of entries) {
      expect(new Date(entry.createdAt).getTime()).toBeLessThan(now);
    }

    // Żaden wpis nie powinien przypadać na dzisiejszą datę.
    const today = new Date().toDateString();
    const onToday = entries.filter(
      (e) => new Date(e.createdAt).toDateString() === today
    );
    expect(onToday).toHaveLength(0);
  });
});
