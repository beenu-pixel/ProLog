import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDayNumber,
  formatMonthYear,
  formatWeekday,
  toExcerpt,
} from "@/lib/format";

// Godzina w datach jest celowo bez „Z", żeby getDate()/toLocaleDateString
// liczyły w lokalnej strefie i nie przesuwały dnia.
const TUESDAY_JUNE_2 = "2026-06-02T20:00:00";
const MAY_28 = "2026-05-28T20:00:00";

describe("formatDayNumber", () => {
  it("zwraca dzień miesiąca z zerem wiodącym", () => {
    expect(formatDayNumber(TUESDAY_JUNE_2)).toBe("02");
    expect(formatDayNumber(MAY_28)).toBe("28");
  });
});

describe("formatWeekday", () => {
  it("zwraca polską nazwę dnia tygodnia", () => {
    expect(formatWeekday(TUESDAY_JUNE_2)).toBe("wtorek");
  });
});

describe("formatMonthYear", () => {
  it("zwraca miesiąc słownie i rok", () => {
    expect(formatMonthYear(TUESDAY_JUNE_2)).toBe("czerwiec 2026");
    expect(formatMonthYear(MAY_28)).toBe("maj 2026");
  });
});

describe("formatDate", () => {
  it("zwraca pełną datę po polsku", () => {
    expect(formatDate(TUESDAY_JUNE_2)).toBe("2 czerwca 2026");
  });
});

describe("toExcerpt", () => {
  it("usuwa znaczniki HTML i normalizuje spacje", () => {
    expect(toExcerpt("<p>Hello <strong>world</strong></p>")).toBe(
      "Hello world"
    );
  });

  it("zamienia &nbsp; na spację", () => {
    expect(toExcerpt("<p>Ala&nbsp;ma&nbsp;kota</p>")).toBe("Ala ma kota");
  });

  it("skraca długi tekst i dokleja wielokropek", () => {
    const long = `<p>${"a".repeat(200)}</p>`;
    const result = toExcerpt(long, 50);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(51);
  });

  it("nie skraca tekstu krótszego niż limit", () => {
    expect(toExcerpt("<p>krótki</p>", 50)).toBe("krótki");
  });
});
