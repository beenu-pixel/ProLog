import { supabaseAdmin } from "@/lib/supabase-admin";
import { recentDaysRangeUtc } from "@/lib/api-day";
import { rowToEntry, type EntryRow } from "@/lib/api-entry";
import { ApiError } from "@/lib/api-error";
import { backfillEmbeddingsForUser, embedText } from "@/lib/services/embeddings";
import type { Entry } from "@/lib/types";

// Wyszukiwanie hybrydowe: top-N z wyszukiwania wektorowego + top-N z full-text,
// scalone w bazie fuzją RRF (funkcja public.hybrid_search), plus warstwa kontekstu
// czasowego — ZAWSZE dołączane wpisy z ostatnich N dni (domyślnie 7), nawet jeśli nie
// pasują tematycznie. Ten sam serwis zasila wyszukiwarkę UI i agenta (RAG, Faza 4).
//
// Scalanie okna „ostatnich dni" z wynikami searcha robimy tutaj (TS), nie w SQL — funkcja
// RPC zostaje prosta, a my mamy pełną kontrolę nad strukturą zwracaną i tagowaniem źródła.
// Wołane kluczem sekretnym (pomija RLS), więc wszędzie jawnie filtrujemy po `userId`.

/** Skąd pochodzi wpis w wynikach: z wyszukiwania, z okna ostatnich dni, lub z obu. */
export type SearchSource = "search" | "recent" | "both";

/** Pojedynczy wynik: wpis + informacja, dlaczego się znalazł (przyda się przy promptcie agenta). */
export interface SearchHit {
  entry: Entry;
  source: SearchSource;
}

export interface HybridSearchOptions {
  /** Ile wpisów zwraca RPC (top-K po RRF). Domyślnie 30. */
  limit?: number;
  /** Szerokość okna kontekstu czasowego w dniach (Europe/Warsaw). Domyślnie 7. */
  recentDays?: number;
}

// Twarde granice zapytania — wartości z ciała żądania (/api/search) lecą wprost do
// RPC i do okna dat, więc bez przycięcia ktoś mógłby poprosić o ogromny match_count
// albo absurdalnie szerokie okno, obciążając bazę. Zaciskamy je do rozsądnych sufitów.
const LIMIT_DEFAULT = 30;
const LIMIT_MAX = 100;
const RECENT_DAYS_DEFAULT = 7;
const RECENT_DAYS_MAX = 90;

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

// Kolumny `entries` potrzebne do zbudowania `Entry` — bez `embedding`/`fts`, by nie
// przesyłać wektorów (1536 floatów na wiersz) ani tsvectora przez sieć.
const ENTRY_COLUMNS =
  "id, title, content, mood, sleep, energy, productivity, stress, photos, created_at, updated_at";

/**
 * Wyszukiwanie hybrydowe dla użytkownika. Zwraca posortowaną listę `SearchHit`:
 * najpierw trafienia wyszukiwania w kolejności RRF (te będące też w oknie ostatnich
 * dni mają `source: 'both'`), potem dodatkowe wpisy z ostatnich dni (`source: 'recent'`,
 * malejąco po dacie). Bez duplikatów. Rzuca `ApiError`/`EmbeddingError`.
 */
export async function hybridSearch(
  userId: string,
  query: string,
  options: HybridSearchOptions = {}
): Promise<SearchHit[]> {
  if (typeof query !== "string" || query.trim() === "") {
    throw new ApiError(400, "Pole `query` jest wymagane (niepusty tekst).");
  }
  if (!supabaseAdmin) {
    throw new ApiError(503, "Usługa niedostępna — brak konfiguracji serwera.");
  }

  const { limit, recentDays } = normalizeSearchLimits(options);

  // 1) Best-effort: domknij embeddingi wpisów dodanych przez UI (mirror nie embeduje).
  //    Gdy braków nie ma → szybki no-op. Błąd nie wywraca wyszukiwania.
  try {
    await backfillEmbeddingsForUser(userId);
  } catch (err) {
    console.error("[services/search] backfill (best-effort) failed:", err);
  }

  // 2) Embedding zapytania (rzuca EmbeddingError przy braku/awarii OPENAI_API_KEY).
  const queryEmbedding = await embedText(query.trim());

  // 3) Wyniki wyszukiwania (RRF) + 4) okno ostatnich dni — równolegle.
  const { startUtc, endUtc } = recentDaysRangeUtc(recentDays);
  const [searchRes, recentRes] = await Promise.all([
    supabaseAdmin
      .rpc("hybrid_search", {
        p_user_id: userId,
        query_text: query.trim(),
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: limit,
      })
      .select(ENTRY_COLUMNS),
    supabaseAdmin
      .from("entries")
      .select(ENTRY_COLUMNS)
      .eq("user_id", userId)
      .gte("created_at", startUtc)
      .lt("created_at", endUtc)
      .order("created_at", { ascending: false }),
  ]);

  if (searchRes.error) {
    console.error("[services/search] hybrid_search rpc failed:", searchRes.error);
    throw new ApiError(500, "Nie udało się wykonać wyszukiwania.");
  }
  if (recentRes.error) {
    console.error("[services/search] recent window select failed:", recentRes.error);
    throw new ApiError(500, "Nie udało się pobrać ostatnich wpisów.");
  }

  // 5) Merge + dedup + tag źródła. Najpierw wyniki searcha (kolejność RRF), potem
  //    dodatkowe wpisy z okna; wpis obecny w obu dostaje `source: 'both'`.
  const hits: SearchHit[] = [];
  const indexById = new Map<string, number>();

  for (const row of (searchRes.data ?? []) as EntryRow[]) {
    indexById.set(row.id, hits.length);
    hits.push({ entry: rowToEntry(row), source: "search" });
  }

  for (const row of (recentRes.data ?? []) as EntryRow[]) {
    const existing = indexById.get(row.id);
    if (existing !== undefined) {
      hits[existing].source = "both";
    } else {
      indexById.set(row.id, hits.length);
      hits.push({ entry: rowToEntry(row), source: "recent" });
    }
  }

  return hits;
}
