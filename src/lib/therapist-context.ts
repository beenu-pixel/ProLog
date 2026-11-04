import type { Entry, Scale } from "@/lib/types";
import type { ActiveContext } from "@/lib/active-context";
import type { SearchHit } from "@/lib/services/search";
import { METRICS, metricLevelLabel } from "@/lib/metrics";
import { dayKey, formatWeekday, toExcerpt } from "@/lib/format";
import { warsawDayKey, warsawWeekday } from "@/lib/api-day";
import { daysOf, rangeLength, type DayRange } from "@/lib/date-range-pl";

// Budowa kontekstu dla modelu w dwóch warstwach (zob. PRD §3):
//  - `buildJournalContext` — STABILNA lista wszystkich wpisów (cache'owalna,
//    zmienia się tylko gdy zmienią się wpisy),
//  - `buildUiContext` — ŚWIEŻA, krótka informacja o tym, co użytkownik ma teraz
//    otwarte oraz jaka jest dzisiejsza data (warstwa zmienna, na końcu żądania).

/** Linia metryk wpisu, np. „Samopoczucie: 4/5 (Dobrze), Sen: 3/5 (Średnio)". */
function metricsLine(entry: Entry): string {
  return METRICS.filter((m) => typeof entry[m.key] === "number")
    .map((m) => {
      const value = entry[m.key] as Scale;
      return `${m.label}: ${value}/5 (${metricLevelLabel(m.key, value)})`;
    })
    .join(", ");
}

/** Nagłówek wpisu: dzień i dzień tygodnia wg czasu polskiego (nie strefy serwera). */
function entryHeader(entry: Entry): string {
  return `[${warsawDayKey(entry.createdAt)}] ${warsawWeekday(entry.createdAt)} — „${entry.title}"`;
}

/** Pojedynczy wpis jako blok tekstu dla modelu (nagłówek + metryki + treść). */
function entryBlock(entry: Entry, maxChars = 4000): string {
  const header = entryHeader(entry);
  const metrics = metricsLine(entry);
  const body = toExcerpt(entry.content, maxChars) || "(brak treści)";
  const lines = [header];
  if (metrics) lines.push(`Metryki: ${metrics}`);
  lines.push(`Treść: ${body}`);
  return lines.join("\n");
}

/** Wpisy posortowane od najstarszego do najnowszego (czytelny przebieg czasu). */
function chronological(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * Pełny dziennik użytkownika jako tekst dla modelu, posortowany od najstarszego
 * do najnowszego (czytelny przebieg czasu dla analizy nastroju).
 */
export function buildJournalContext(entries: Entry[]): string {
  if (entries.length === 0) {
    return "WPISY Z DZIENNIKA: użytkownik nie ma jeszcze żadnych wpisów.";
  }

  const blocks = chronological(entries).map((e) => entryBlock(e));

  return (
    "WPISY Z DZIENNIKA (wszystkie wpisy użytkownika, od najstarszego do najnowszego; metryki w skali 1–5):\n\n" +
    blocks.join("\n---\n")
  );
}

/**
 * Kontekst dziennika zbudowany z wyników wyszukiwania hybrydowego (RAG): WYBRANY
 * podzbiór — najtrafniejsze dla pytania wpisy + wszystkie z ostatnich dni — a NIE
 * cały dziennik. Intro mówi o tym wprost, by model nie zakładał kompletności i nie
 * zmyślał brakujących wpisów. Wpisy sortujemy chronologicznie (jak `buildJournalContext`).
 */
export function buildJournalContextFromHits(hits: SearchHit[]): string {
  return buildPersonaJournalContext({ hits });
}

// ── Wpisy dla persony: zakresy dat + wybrane wpisy ───────────────────────────

/** Wpisy z jednego zakresu dat, pobrane z bazy po `user_id`. */
export interface RangeSlice {
  /** Zakres faktycznie pobrany (po ewentualnym przycięciu do limitu dni planu). */
  range: DayRange;
  /** Zakres z pytania, gdy był dłuższy niż limit planu (wtedy `range` to jego koniec). */
  requested?: DayRange;
  /** Wszystkie wpisy w `range` wg bazy. */
  total: number;
  /** Wpisy przekazane modelowi (≤ `total`), dowolna kolejność. */
  entries: Entry[];
  /** Ile wpisów z `entries` dostaje pełną treść (reszta skrótem). */
  fullEntries: number;
  /** Zakres wzięty z poprzedniego pytania (bieżące nie podaje daty). */
  fromEarlierMessage?: boolean;
}

export interface PersonaJournalInput {
  slices?: RangeSlice[];
  /** Wyniki wyszukiwania (najtrafniejsze + ostatnie dni); `null` = wyszukiwanie padło. */
  hits?: SearchHit[] | null;
}

/** „1 wpis", „2 wpisy", „5 wpisów", „22 wpisy". */
export function entriesWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "1 wpis";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} wpisy`;
  return `${n} wpisów`;
}

function rangeLabel(range: DayRange): string {
  return range.from === range.to ? `z dnia ${range.from}` : `z dni ${range.from} – ${range.to}`;
}

/** Sam okres: „2026-07-24" albo „2026-07-01 – 2026-07-31". */
function periodLabel(range: DayRange): string {
  return range.from === range.to ? range.from : `${range.from} – ${range.to}`;
}

/** Krótka linia wpisu: data, tytuł, metryki — bez treści. */
function entryLine(entry: Entry): string {
  const metrics = metricsLine(entry);
  return `${entryHeader(entry)}${metrics ? ` · ${metrics}` : ""} (bez treści)`;
}

/** Indeksy `k` z `n` elementów rozłożone równo (pełna treść dla przekroju okresu). */
function spreadIndexes(n: number, k: number): Set<number> {
  if (k >= n) return new Set(Array.from({ length: n }, (_, i) => i));
  const out = new Set<number>();
  if (k <= 0) return out;
  if (k === 1) return new Set([n - 1]);
  for (let i = 0; i < k; i++) out.add(Math.round((i * (n - 1)) / (k - 1)));
  return out;
}

/** Dni zakresu bez żadnego wpisu (tylko dla zakresów pobranych w całości). */
function emptyDays(slice: RangeSlice): string[] {
  const withEntry = new Set(slice.entries.map((e) => warsawDayKey(e.createdAt)));
  return daysOf(slice.range).filter((d) => !withEntry.has(d));
}

const MAX_EMPTY_DAYS_LISTED = 62;
const RANGE_EXCERPT_CHARS = 1500;

/**
 * Wpisy dla persony jako jedna wiadomość `system`. Na początku opis tego, co
 * model dostał — które zakresy dat są kompletne, a co jest tylko wyborem —
 * żeby nie twierdził „nie ma wpisu", gdy po prostu go nie widzi, i nie podawał
 * liczby wpisów z wycinka. Bez słowa „kontekst": persona ma mówić o wpisach.
 */
export function buildPersonaJournalContext(input: PersonaJournalInput): string {
  const slices = input.slices ?? [];
  const hits = input.hits ?? null;

  const inRanges = new Set<string>();
  for (const s of slices) for (const e of s.entries) inRanges.add(e.id);
  const selected = (hits ?? []).filter((h) => !inRanges.has(h.entry.id));

  const summary: string[] = [];
  const sections: string[] = [];
  const completeLabels: string[] = [];

  for (const slice of slices) {
    const complete = slice.entries.length >= slice.total && !slice.requested;
    const label = rangeLabel(slice.range);
    const oneDay = slice.range.from === slice.range.to;
    const these = oneDay ? "tego dnia" : "tych dni";
    const origin = slice.fromEarlierMessage ? " (okres z wcześniejszego pytania)" : "";

    if (slice.requested) {
      summary.push(
        `- Pytanie obejmuje dni ${slice.requested.from} – ${slice.requested.to}, ale pobrano tylko ` +
          `ostatnie ${rangeLength(slice.range)} dni tego okresu (${slice.range.from} – ${slice.range.to}). ` +
          "O wcześniejszych dniach z pytania nic nie wiesz."
      );
    }
    if (slice.total === 0) {
      summary.push(`- Wpisy ${label}${origin}: brak. W dzienniku nie ma żadnego wpisu z ${these}.`);
      if (!slice.requested) completeLabels.push(periodLabel(slice.range));
      continue;
    }
    if (slice.entries.length >= slice.total) {
      summary.push(
        `- Wpisy ${label}${origin}: ${entriesWord(slice.total)} — to wszystkie wpisy z ${these}.`
      );
    } else {
      summary.push(
        `- Wpisy ${label}${origin}: w dzienniku jest ich ${slice.total}, dostajesz ` +
          `${slice.entries.length} (limit planu). O pozostałych wpisach z ${these} nic nie wiesz.`
      );
    }
    if (complete) {
      completeLabels.push(periodLabel(slice.range));
      const empty = emptyDays(slice);
      if (empty.length > 0 && rangeLength(slice.range) > 1 && empty.length <= MAX_EMPTY_DAYS_LISTED) {
        summary.push(`  Dni bez wpisu w tym okresie: ${empty.join(", ")}.`);
      }
    }

    const sorted = chronological(slice.entries);
    const full = spreadIndexes(sorted.length, slice.fullEntries);
    if (full.size < sorted.length) {
      summary.push(
        `  Pełną treść ma ${entriesWord(full.size)}; pozostałe są skrócone do daty, tytułu i metryk.`
      );
    }
    const blocks = sorted.map((e, i) =>
      full.has(i) ? entryBlock(e, RANGE_EXCERPT_CHARS) : entryLine(e)
    );
    sections.push(`=== WPISY ${label.toUpperCase()} ===\n\n${blocks.join("\n---\n")}`);
  }

  if (hits === null) {
    summary.push("- Wyszukiwanie najtrafniejszych wpisów jest chwilowo niedostępne.");
  } else if (selected.length > 0) {
    summary.push(
      `- Wybrane wpisy: najtrafniejsze dla pytania oraz z ostatnich dni — ${entriesWord(selected.length)}` +
        `${slices.length > 0 ? " spoza okresów powyżej" : ""}. To tylko wybór, nie cały dziennik.`
    );
    const blocks = chronological(selected.map((h) => h.entry)).map((e) => entryBlock(e));
    sections.push(`=== WYBRANE WPISY ===\n\n${blocks.join("\n---\n")}`);
  } else if (slices.length === 0) {
    summary.push(
      "- Do tego pytania nie znalazłem pasujących wpisów ani wpisów z ostatnich dni. " +
        "Nie znaczy to, że dziennik jest pusty."
    );
  }

  const rule =
    completeLabels.length > 0
      ? `Że jakiegoś dnia nie ma wpisu, możesz powiedzieć tylko o dniach z okresów: ${completeLabels.join(
          ", "
        )}. O innych dniach widzisz tylko część dziennika — powiedz to wprost, zamiast twierdzić, że wpisu nie ma.`
      : "Widzisz tylko część dziennika. Nie twierdź, że jakiegoś dnia nie ma wpisu ani ile jest wpisów w danym okresie — powiedz, że widzisz tylko część, i zaproponuj pytanie o konkretny dzień lub okres.";

  return [
    "WPISY Z DZIENNIKA (metryki w skali 1–5)",
    "",
    "CO DOSTAJESZ",
    ...summary,
    rule,
    ...(sections.length > 0 ? ["", sections.join("\n\n")] : []),
  ].join("\n");
}

/**
 * Świeża, krótka informacja o bieżącym widoku: który dzień/wpis jest otwarty
 * oraz jaka jest dzisiejsza data. Pozwala Freudowi celnie reagować na pytania
 * typu „o tym dniu" / „dziś".
 */
export function buildUiContext(active: ActiveContext, entries: Entry[]): string {
  const today = new Date();
  const lines: string[] = ["BIEŻĄCY WIDOK (co użytkownik ma teraz otwarte):"];

  if (active.openEntryId) {
    const open = entries.find((e) => e.id === active.openEntryId);
    if (open) {
      lines.push(
        `Użytkownik ma teraz otwarty konkretny wpis z dnia ${dayKey(
          open.createdAt
        )} (${formatWeekday(open.createdAt)}) o tytule „${open.title}".`
      );
    }
  } else if (active.openDayKey) {
    lines.push(
      `Użytkownik ma teraz otwarty dzień: ${active.openDayKey}, ${formatWeekday(
        active.openDayKey
      )}.`
    );
    const titles = entries
      .filter((e) => dayKey(e.createdAt) === active.openDayKey)
      .map((e) => `„${e.title}"`);
    if (titles.length > 0) {
      lines.push(`Wpis(y) tego dnia: ${titles.join(", ")}.`);
    } else {
      lines.push("Ten dzień nie ma jeszcze żadnego wpisu.");
    }
  }

  lines.push(`Data dzisiejsza: ${dayKey(today)}, ${formatWeekday(dayKey(today))}.`);
  return lines.join("\n");
}
