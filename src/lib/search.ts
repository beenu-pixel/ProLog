import type { Entry } from "@/lib/types";
import { toExcerpt } from "@/lib/format";

/** Usuwa polskie znaki diakrytyczne, aby „srodA" pasowało do „środa". */
function deburr(value: string): string {
  // ̀–ͯ to zakres łączących znaków diakrytycznych (po normalizacji NFD).
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(value: string): string {
  return deburr(value).toLowerCase();
}

/**
 * Buduje przeszukiwalny tekst wpisu: tytuł, początek treści oraz datę w wielu
 * zapisach (dzień, dzień tygodnia, miesiąc słownie, rok, formaty liczbowe).
 * Dzięki temu można szukać np. „29 maj", „piątek" albo „2026-05-29".
 */
function haystack(entry: Entry): string {
  const date = new Date(entry.createdAt);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");

  const parts = [
    entry.title,
    toExcerpt(entry.content, 500),
    String(day),
    pad(day),
    date.toLocaleDateString("pl-PL", { weekday: "long" }),
    date.toLocaleDateString("pl-PL", { month: "long" }),
    String(year),
    `${year}-${pad(month)}-${pad(day)}`,
    `${pad(day)}.${pad(month)}.${year}`,
    `${day}.${month}.${year}`,
  ];

  return normalize(parts.join(" "));
}

/**
 * Czy wpis pasuje do zapytania. Zapytanie dzielone jest na tokeny — każdy musi
 * wystąpić w przeszukiwalnym tekście (logiczne AND), więc „29 maj" zawęża wynik.
 */
export function entryMatches(entry: Entry, query: string): boolean {
  const q = normalize(query).trim();
  if (!q) return true;
  const hay = haystack(entry);
  return q.split(/\s+/).every((token) => hay.includes(token));
}
