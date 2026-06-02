import { describe, expect, it } from "vitest";

import { entryMatches } from "@/lib/search";
import type { Entry } from "@/lib/types";

// 2026-05-28 to czwartek; godzina bez „Z", by nie przesuwać dnia w innej strefie.
const entry: Entry = {
  id: "seed-03",
  title: "Dużo stresu w pracy",
  content: "<p>Trudny dzień w pracy, dużo stresu. Wieczorem czytałem książkę.</p>",
  mood: 2,
  createdAt: "2026-05-28T20:00:00",
};

describe("entryMatches", () => {
  it("puste zapytanie pasuje do każdego wpisu", () => {
    expect(entryMatches(entry, "")).toBe(true);
    expect(entryMatches(entry, "   ")).toBe(true);
  });

  it("dopasowuje po tytule (bez względu na wielkość liter)", () => {
    expect(entryMatches(entry, "stresu")).toBe(true);
    expect(entryMatches(entry, "STRESU")).toBe(true);
  });

  it("dopasowuje po treści wpisu", () => {
    expect(entryMatches(entry, "książkę")).toBe(true);
  });

  it("ignoruje polskie znaki diakrytyczne (deburr)", () => {
    // „dzień" w treści powinno pasować do zapytania „dzien".
    expect(entryMatches(entry, "dzien")).toBe(true);
  });

  it("dopasowuje po dniu miesiąca", () => {
    expect(entryMatches(entry, "28")).toBe(true);
  });

  it("dopasowuje po dniu tygodnia", () => {
    expect(entryMatches(entry, "czwartek")).toBe(true);
  });

  it("dopasowuje po miesiącu słownie i po roku", () => {
    expect(entryMatches(entry, "maj")).toBe(true);
    expect(entryMatches(entry, "2026")).toBe(true);
  });

  it("dopasowuje po formacie liczbowym daty", () => {
    expect(entryMatches(entry, "2026-05-28")).toBe(true);
    expect(entryMatches(entry, "28.05.2026")).toBe(true);
  });

  it("łączy tokeny logicznym AND — wszystkie muszą wystąpić", () => {
    expect(entryMatches(entry, "28 czwartek")).toBe(true);
    expect(entryMatches(entry, "28 maj")).toBe(true);
    // „28" pasuje, ale „kwiecień" już nie → całość nie pasuje.
    expect(entryMatches(entry, "28 kwiecień")).toBe(false);
  });

  it("nie dopasowuje, gdy zapytanie nie występuje", () => {
    expect(entryMatches(entry, "29")).toBe(false);
    expect(entryMatches(entry, "rower")).toBe(false);
  });
});
