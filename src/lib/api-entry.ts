import type { Entry } from "@/lib/types";
import { toExcerpt } from "@/lib/format";

// Pomocnicze dla endpointów wpisów: deterministyczny tytuł z treści oraz
// mapowanie wiersza tabeli `entries` (snake_case) ↔ `Entry` (camelCase),
// analogicznie do `fromRow`/`toRow` w `src/lib/sync.ts`, ale dla zapisu
// service-rolem z jawnym `user_id`.

/** Surowy wiersz `public.entries` (metryki mogą być null). */
export interface EntryRow {
  id: string;
  title: string;
  content: string;
  mood: number | null;
  sleep: number | null;
  energy: number | null;
  productivity: number | null;
  stress: number | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Tytuł wpisu wywnioskowany z treści — pierwsze ~8 słów (do ~60 znaków),
 * po odcięciu HTML. Bez wywołania modelu (szybko i bez kosztu).
 */
export function deriveTitle(content: string): string {
  const text = toExcerpt(content, 80);
  if (!text) return "Wpis";
  const words = text.split(/\s+/).slice(0, 8).join(" ");
  const trimmed = words.length > 60 ? words.slice(0, 60).trimEnd() + "…" : words;
  return trimmed || "Wpis";
}

/** Mapuje wiersz bazy na `Entry` (null → undefined, snake_case → camelCase). */
export function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    mood: row.mood ?? undefined,
    sleep: row.sleep ?? undefined,
    energy: row.energy ?? undefined,
    productivity: row.productivity ?? undefined,
    stress: row.stress ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  } as Entry;
}
