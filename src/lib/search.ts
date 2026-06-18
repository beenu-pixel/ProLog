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

/** Przeszukiwalna reprezentacja wpisu z rozdzielonymi polami daty. */
interface Searchable {
  /** Tekst swobodny: tytuł, początek treści, dzień tygodnia, miesiąc słownie. */
  text: string;
  /** Dzień miesiąca w obu zapisach, np. "6" i "06". */
  dayStr: string;
  dayPad: string;
  /** Rok (4 cyfry), np. "2026". */
  yearStr: string;
  /** Pełne, liczbowe zapisy daty — dopasowywane tylko dla tokenów z separatorem. */
  dateFormats: string[];
}

/** Trafność dopasowania tokenu: data > tekst > brak. */
const TIER_DATE = 2;
const TIER_TEXT = 1;
const TIER_NONE = 0;

/**
 * Buduje przeszukiwalną reprezentację wpisu. Tekst swobodny (tytuł, treść, dzień
 * tygodnia, miesiąc słownie) trzymamy osobno od liczbowych pól daty, aby zapytanie
 * liczbowe rozróżniało dopasowanie po dacie (dzień/rok) od wystąpienia tej liczby
 * w treści. Daty (ISO, rok) celowo NIE trafiają do `text`, żeby np. „02" nie łapało
 * wszystkich wpisów z roku 2026 przez podciąg.
 */
function searchable(entry: Entry): Searchable {
  const date = new Date(entry.createdAt);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");

  const text = normalize(
    [
      entry.title,
      toExcerpt(entry.content, 500),
      date.toLocaleDateString("pl-PL", { weekday: "long" }),
      date.toLocaleDateString("pl-PL", { month: "long" }),
    ].join(" ")
  );

  return {
    text,
    dayStr: String(day),
    dayPad: pad(day),
    yearStr: String(year),
    dateFormats: [
      `${year}-${pad(month)}-${pad(day)}`,
      `${pad(day)}.${pad(month)}.${year}`,
      `${day}.${month}.${year}`,
    ],
  };
}

/**
 * Trafność pojedynczego tokenu względem wpisu:
 *  - `TIER_DATE` — token to data: pełny zapis z separatorem, dzień miesiąca lub rok,
 *  - `TIER_TEXT` — token występuje w tekście (tytuł/treść/dzień tygodnia/miesiąc),
 *    w tym liczba zawarta w treści (np. „15" w „1500"),
 *  - `TIER_NONE` — brak dopasowania.
 */
function tokenTier(token: string, s: Searchable): number {
  // Token z separatorem daty („-" / „.") → tylko pełne zapisy daty.
  if (token.includes("-") || token.includes(".")) {
    return s.dateFormats.some((format) => format.includes(token))
      ? TIER_DATE
      : TIER_NONE;
  }

  // Token czysto liczbowy → najpierw próbujemy jako data (dzień/rok), a gdy nie
  // pasuje, jako liczba występująca w treści (niższy priorytet).
  if (/^\d+$/.test(token)) {
    if (token === s.dayStr || token === s.dayPad || token === s.yearStr) {
      return TIER_DATE;
    }
    return s.text.includes(token) ? TIER_TEXT : TIER_NONE;
  }

  // Token tekstowy → swobodne wyszukiwanie w tekście.
  return s.text.includes(token) ? TIER_TEXT : TIER_NONE;
}

/**
 * Czy wpis pasuje do zapytania. Zapytanie dzielone jest na tokeny — każdy musi
 * pasować do wpisu (logiczne AND). Patrz `tokenTier` po szczegóły dopasowania.
 */
export function entryMatches(entry: Entry, query: string): boolean {
  const q = normalize(query).trim();
  if (!q) return true;
  const s = searchable(entry);
  return q.split(/\s+/).every((token) => tokenTier(token, s) > TIER_NONE);
}

/**
 * Filtruje i porządkuje wpisy wg trafności do zapytania. Wpisy dopasowane po
 * dacie (dzień/rok/pełny zapis) trafiają nad te, które jedynie zawierają szukaną
 * liczbę/tekst w treści. Wewnątrz tej samej trafności zachowujemy kolejność
 * wejścia (najnowsze u góry — sort jest stabilny). Puste zapytanie zwraca wejście
 * bez zmian.
 */
export function searchEntries(entries: Entry[], query: string): Entry[] {
  const q = normalize(query).trim();
  if (!q) return entries;
  const tokens = q.split(/\s+/);

  const scored: { entry: Entry; score: number }[] = [];
  for (const entry of entries) {
    const s = searchable(entry);
    let score = 0;
    let matchesAll = true;
    for (const token of tokens) {
      const tier = tokenTier(token, s);
      if (tier === TIER_NONE) {
        matchesAll = false;
        break;
      }
      score += tier;
    }
    if (matchesAll) scored.push({ entry, score });
  }

  // Sort stabilny: malejąco po trafności; remisy zachowują kolejność wejścia.
  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.entry);
}
