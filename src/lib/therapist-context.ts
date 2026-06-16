import type { Entry, Scale } from "@/lib/types";
import type { ActiveContext } from "@/lib/active-context";
import type { SearchHit } from "@/lib/services/search";
import { METRICS, metricLevelLabel } from "@/lib/metrics";
import { dayKey, formatWeekday, toExcerpt } from "@/lib/format";

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

/** Pojedynczy wpis jako blok tekstu dla modelu (nagłówek + metryki + treść). */
function entryBlock(entry: Entry): string {
  const header = `[${dayKey(entry.createdAt)}] ${formatWeekday(
    entry.createdAt
  )} — „${entry.title}"`;
  const metrics = metricsLine(entry);
  const body = toExcerpt(entry.content, 4000) || "(brak treści)";
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
    return "KONTEKST DZIENNIKA: użytkownik nie ma jeszcze żadnych wpisów.";
  }

  const blocks = chronological(entries).map(entryBlock);

  return (
    "KONTEKST DZIENNIKA (wszystkie wpisy użytkownika, od najstarszego do najnowszego; metryki w skali 1–5):\n\n" +
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
  if (hits.length === 0) {
    return "KONTEKST DZIENNIKA: użytkownik nie ma jeszcze żadnych wpisów.";
  }

  const blocks = chronological(hits.map((h) => h.entry)).map(entryBlock);

  return (
    "KONTEKST DZIENNIKA (WYBRANE wpisy: najbardziej trafne dla pytania użytkownika " +
    "oraz wszystkie z ostatnich dni — to NIE jest cały dziennik; metryki w skali 1–5). " +
    "Jeśli pytanie dotyczy czegoś, czego tu nie ma, powiedz o tym wprost lub poproś o " +
    "doprecyzowanie zamiast zgadywać:\n\n" +
    blocks.join("\n---\n")
  );
}

/**
 * Świeża, krótka informacja o bieżącym widoku: który dzień/wpis jest otwarty
 * oraz jaka jest dzisiejsza data. Pozwala Freudowi celnie reagować na pytania
 * typu „o tym dniu" / „dziś".
 */
export function buildUiContext(active: ActiveContext, entries: Entry[]): string {
  const today = new Date();
  const lines: string[] = ["KONTEKST UI (bieżący widok użytkownika):"];

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
