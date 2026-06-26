import { ApiError } from "@/lib/api-error";
import { embedText } from "@/lib/services/embeddings";
import { matchEntries, recentEntryRefs } from "@/lib/services/entry-index";
import { getEntriesByLocalIds } from "@/lib/services/cms-entries";
import type { Entry } from "@/lib/types";

// Wyszukiwanie dla RAG i wyszukiwarki UI po przejściu na Strapi jako źródło prawdy:
//  - WEKTOR: indeks `entry_index` w Supabase (embedding + link) → RPC `match_entries`,
//  - RECENCY: zawsze dołączane wpisy z ostatnich N dni (po `entry_date` z indeksu),
//  - TREŚĆ: dociągana ze Strapi po `localId` (źródło prawdy).
// Część leksykalna (full-text) hybrydy została wycofana wraz z migracją — zostaje
// wyszukiwanie wektorowe. Ten sam serwis zasila wyszukiwarkę UI i agenta (RAG).

/** Skąd pochodzi wpis w wynikach: z wyszukiwania, z okna ostatnich dni, lub z obu. */
export type SearchSource = "search" | "recent" | "both";

/** Pojedynczy wynik: wpis + informacja, dlaczego się znalazł (przyda się przy promptcie agenta). */
export interface SearchHit {
  entry: Entry;
  source: SearchSource;
}

export interface HybridSearchOptions {
  /** Ile wpisów zwraca wyszukiwanie wektorowe (top-K). Domyślnie 30. */
  limit?: number;
  /** Szerokość okna kontekstu czasowego w dniach. Domyślnie 7. */
  recentDays?: number;
}

// Twarde granice zapytania — wartości z ciała żądania (/api/search) lecą wprost do
// RPC i do okna dat, więc bez przycięcia ktoś mógłby poprosić o ogromny match_count
// albo absurdalnie szerokie okno. Zaciskamy je do rozsądnych sufitów.
const LIMIT_DEFAULT = 30;
const LIMIT_MAX = 100;
const RECENT_DAYS_DEFAULT = 7;
const RECENT_DAYS_MAX = 90;
const RECENT_LIMIT = 50;

/** Przycina liczbę do [min, max]; dla wartości spoza zakresu liczb zwraca `fallback`. */
function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Normalizuje opcje wyszukiwania do bezpiecznych granic (eksport dla testów). */
export function normalizeSearchLimits(options: HybridSearchOptions = {}): {
  limit: number;
  recentDays: number;
} {
  return {
    limit: clampInt(options.limit, LIMIT_DEFAULT, 1, LIMIT_MAX),
    recentDays: clampInt(options.recentDays, RECENT_DAYS_DEFAULT, 1, RECENT_DAYS_MAX),
  };
}

/**
 * Wyszukiwanie dla użytkownika. Zwraca posortowaną listę `SearchHit`: najpierw
 * trafienia wektorowe (te będące też w oknie ostatnich dni mają `source: 'both'`),
 * potem dodatkowe wpisy z ostatnich dni (`source: 'recent'`). Bez duplikatów.
 * Treść wpisów dociągana ze Strapi. Rzuca `ApiError`/`EmbeddingError`.
 */
export async function hybridSearch(
  userId: string,
  query: string,
  options: HybridSearchOptions = {}
): Promise<SearchHit[]> {
  if (typeof query !== "string" || query.trim() === "") {
    throw new ApiError(400, "Pole `query` jest wymagane (niepusty tekst).");
  }

  const { limit, recentDays } = normalizeSearchLimits(options);

  // 1) Embedding zapytania (rzuca EmbeddingError przy braku/awarii OPENAI_API_KEY).
  const queryEmbedding = await embedText(query.trim());

  // 2) Wektor (match_entries) + 3) okno ostatnich dni — równolegle (oba z indeksu Supabase).
  const [matches, recent] = await Promise.all([
    matchEntries(userId, queryEmbedding, limit),
    recentEntryRefs(userId, recentDays, RECENT_LIMIT),
  ]);

  // 4) Kolejność + tag źródła: najpierw wektor (kolejność podobieństwa), potem recency.
  const order: { localId: string; source: SearchSource }[] = [];
  const indexById = new Map<string, number>();

  for (const m of matches) {
    indexById.set(m.localId, order.length);
    order.push({ localId: m.localId, source: "search" });
  }
  for (const r of recent) {
    const existing = indexById.get(r.localId);
    if (existing !== undefined) {
      order[existing].source = "both";
    } else {
      indexById.set(r.localId, order.length);
      order.push({ localId: r.localId, source: "recent" });
    }
  }

  if (order.length === 0) return [];

  // 5) Treść ze Strapi (źródło prawdy) po localId; zachowujemy ustaloną kolejność.
  const entries = await getEntriesByLocalIds(userId, order.map((o) => o.localId));
  const byId = new Map(entries.map((e) => [e.id, e]));

  const hits: SearchHit[] = [];
  for (const o of order) {
    const entry = byId.get(o.localId);
    if (entry) hits.push({ entry, source: o.source });
  }
  return hits;
}
