import { describe, expect, it } from "vitest";

import { entryMatches, searchEntries } from "@/lib/search";
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

  // 2026-06-14 — wpis czerwcowy, dzień 14, do testów kolizji cyfr daty.
  const june14: Entry = {
    id: "x-june-14",
    title: "Włochy — cały album",
    content: "<p>Przeglądałem zdjęcia z Włoch.</p>",
    mood: 4,
    createdAt: "2026-06-14T18:00:00",
  };

  it("liczba nie łapie wpisu przez cyfry miesiąca/roku w dacie", () => {
    expect(entryMatches(june14, "14")).toBe(true); // dzień
    // „06" to miesiąc czerwiec — NIE może łapać wpisu z czerwca po numerze dnia
    // (treść tego wpisu nie zawiera „06").
    expect(entryMatches(june14, "06")).toBe(false);
    // „02" jest podciągiem roku „2026" — nie może fałszywie pasować przez datę.
    expect(entryMatches(june14, "02")).toBe(false);
    // rok nadal działa (dokładne 4 cyfry).
    expect(entryMatches(june14, "2026")).toBe(true);
  });

  it("liczba pasuje też, gdy występuje w treści wpisu", () => {
    const run: Entry = {
      id: "run",
      title: "Bieg",
      content: "<p>Przebiegłem 1500 metrów.</p>",
      mood: 4,
      createdAt: "2026-03-09T18:00:00", // dzień 9, nie 15
    };
    // „15" nie jest datą tego wpisu, ale jest w treści („1500").
    expect(entryMatches(run, "15")).toBe(true);
  });

  describe("searchEntries — ranking", () => {
    const day15: Entry = {
      id: "day15",
      title: "Piętnasty",
      content: "<p>Zwykły dzień.</p>",
      mood: 3,
      createdAt: "2026-04-15T18:00:00", // 15 jako DATA (dzień)
    };
    const text15: Entry = {
      id: "text15",
      title: "Bieg",
      content: "<p>Przebiegłem 1500 metrów.</p>", // 15 tylko w TREŚCI
      mood: 4,
      createdAt: "2026-04-09T18:00:00",
    };
    const none: Entry = {
      id: "none",
      title: "Nic wspólnego",
      content: "<p>Inny dzień.</p>",
      mood: 3,
      createdAt: "2026-04-20T18:00:00",
    };

    it("dopasowania po dacie idą nad dopasowania z treści", () => {
      // Wejście w kolejności „najnowsze u góry": none(20), day15(15), text15(09).
      const result = searchEntries([none, day15, text15], "15");
      expect(result.map((e) => e.id)).toEqual(["day15", "text15"]);
    });

    it("puste zapytanie zwraca wejście bez zmian", () => {
      const input = [none, day15, text15];
      expect(searchEntries(input, "")).toBe(input);
    });
  });
});
