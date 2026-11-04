import { supabaseAdmin } from "@/lib/supabase-admin";
import { toExcerpt } from "@/lib/format";

// Embeddingi wpisów dziennika — jeden wektor semantyczny na wpis (bez chunkowania).
// Model OpenAI `text-embedding-3-small` zwraca wektor o 1536 wymiarach, dlatego
// kolumna `entries.embedding` ma typ vector(1536). Klucz `OPENAI_API_KEY` jest
// zmienną SERWEROWĄ — nigdy z prefiksem NEXT_PUBLIC_, nigdy do przeglądarki.
//
// API OpenAI jest proste (REST), więc — spójnie z xai.ts/transcribe — używamy
// gołego `fetch`, bez SDK.

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

// Górny limit znaków pojedynczego wejścia (ochrona limitu ~8191 tokenów modelu;
// 1 token ≈ kilka znaków, 8000 znaków bezpiecznie się mieści).
const MAX_INPUT_CHARS = 8000;
// Ile wpisów embedujemy jednym żądaniem (API przyjmuje tablicę `input`).
const BATCH_SIZE = 64;

/** Błąd wywołania OpenAI z kodem HTTP do zmapowania na odpowiedź endpointu. */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

/**
 * Tekst wejściowy embeddingu: tytuł + treść (HTML treści zdejmujemy do czystego
 * tekstu i przycinamy). To samo źródło dla backfillu i dla nowych wpisów.
 */
export function buildEmbeddingInput(title: string, content: string): string {
  const body = toExcerpt(content, MAX_INPUT_CHARS);
  return `${title}\n\n${body}`.trim();
}

/**
 * Liczy embeddingi dla partii tekstów jednym żądaniem. Zwraca wektory w tej samej
 * kolejności co wejście. Rzuca `EmbeddingError` (503 bez klucza, 502 przy błędzie
 * usługi lub niespójnej odpowiedzi).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError("Brak OPENAI_API_KEY — embeddingi niedostępne.", 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    });
  } catch (err) {
    console.error("[embeddings] fetch failed:", err);
    throw new EmbeddingError("Nie udało się połączyć z OpenAI.", 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("[embeddings] upstream error:", upstream.status, detail);
    throw new EmbeddingError("Zapytanie o embeddingi nie powiodło się.", 502);
  }

  let data: { data?: { embedding?: number[]; index?: number }[] };
  try {
    data = (await upstream.json()) as typeof data;
  } catch {
    throw new EmbeddingError("Niepoprawna odpowiedź OpenAI.", 502);
  }

  const items = data.data ?? [];
  if (items.length !== texts.length) {
    throw new EmbeddingError("OpenAI zwróciło niepełny zestaw wektorów.", 502);
  }

  // Porządkujemy po `index` (API zwykle zachowuje kolejność, ale nie zakładamy tego).
  const ordered = [...items].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return ordered.map((item) => {
    const vec = item.embedding;
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIM) {
      throw new EmbeddingError("OpenAI zwróciło wektor o złym wymiarze.", 502);
    }
    return vec;
  });
}

/** Embedding pojedynczego tekstu (cienki wrapper na `embedBatch`). */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  return vec;
}

/** pgvector przyjmuje literał tekstowy „[0.1,0.2,…]". */
function toVectorLiteral(vec: number[]): string {
  return JSON.stringify(vec);
}

interface BackfillRow {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
}

export interface BackfillResult {
  /** Wpisy przejrzane (wszystkie w zakresie: jedno konto albo wszystkie). */
  scanned: number;
  /** Wpisy bez wektora w `entry_index` przed tym uruchomieniem. */
  missing: number;
  /** Wektory zapisane w tym uruchomieniu. */
  embedded: number;
  /** Wpisy, których nie udało się zaindeksować (błąd partii lub zapisu). */
  failed: number;
  /** Braki zostawione na kolejne wywołanie (powyżej `maxPerRun`). */
  remaining: number;
}

export interface BackfillOptions {
  /** Zawęża do jednego konta. */
  userId?: string;
  /** Ile brakujących wpisów przetwarza jedno wywołanie (domyślnie 500, max 2000). */
  maxPerRun?: number;
}

/** Stronicowanie PostgREST: serwer oddaje najwyżej 1000 wierszy na zapytanie. */
const PAGE = 1000;
const MAX_PER_RUN_DEFAULT = 500;
const MAX_PER_RUN_CAP = 2000;

function db() {
  if (!supabaseAdmin) {
    throw new EmbeddingError("Brak konfiguracji serwera Supabase.", 503);
  }
  return supabaseAdmin;
}

/** Wszystkie wpisy (jednego konta albo wszystkich), stronami po `PAGE`. */
async function listEntriesForBackfill(userId?: string): Promise<BackfillRow[]> {
  const out: BackfillRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db()
      .from("entries")
      .select("id, user_id, title, content, created_at")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) {
      console.error("[embeddings] entries select failed:", error);
      throw new EmbeddingError("Nie udało się pobrać wpisów do embeddowania.", 500);
    }
    const rows = (data ?? []) as BackfillRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Id wpisów, które mają już wektor w `entry_index`. */
async function indexedIds(userId?: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    let query = db()
      .from("entry_index")
      .select("local_id")
      .not("embedding", "is", null)
      .order("local_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) {
      console.error("[embeddings] entry_index select failed:", error);
      throw new EmbeddingError("Nie udało się odczytać indeksu wyszukiwania.", 500);
    }
    const rows = (data ?? []) as { local_id: string }[];
    for (const r of rows) ids.add(r.local_id);
    if (rows.length < PAGE) break;
  }
  return ids;
}

/**
 * Uzupełnia wektory w `entry_index` — tabeli, z której czyta wyszukiwanie
 * (RPC `match_entries`). Wcześniej backfill pisał do `entries.embedding`, której
 * wyszukiwanie już nie używa, więc nie naprawiał braków w indeksie.
 *
 * Idempotentny: brak = wpis bez wiersza w indeksie albo z wierszem bez wektora.
 * Przetwarza partiami po `BATCH_SIZE` (jedno żądanie do OpenAI + jeden upsert
 * na partię) i najwyżej `maxPerRun` braków na wywołanie; reszta zostaje jako
 * `remaining` na kolejne wywołanie. Błąd jednej partii jest liczony w `failed`
 * i nie przerywa pozostałych; brak klucza OpenAI przerywa cały proces.
 */
async function runBackfill(options: BackfillOptions = {}): Promise<BackfillResult> {
  const maxPerRun = Math.min(
    MAX_PER_RUN_CAP,
    Math.max(1, Math.trunc(options.maxPerRun ?? MAX_PER_RUN_DEFAULT))
  );

  const [entries, indexed] = await Promise.all([
    listEntriesForBackfill(options.userId),
    indexedIds(options.userId),
  ]);
  const missing = entries.filter((e) => !indexed.has(e.id));
  const todo = missing.slice(0, maxPerRun);

  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    const inputs = batch.map((r) => buildEmbeddingInput(r.title, r.content ?? ""));

    let vectors: number[][];
    try {
      vectors = await embedBatch(inputs);
    } catch (err) {
      // Brak klucza dotyczy całego procesu — przerywamy z wyraźnym błędem.
      if (err instanceof EmbeddingError && err.status === 503) throw err;
      console.error("[embeddings] batch embed failed:", err);
      failed += batch.length;
      continue;
    }

    const now = new Date().toISOString();
    const { error } = await db()
      .from("entry_index")
      .upsert(
        batch.map((r, j) => ({
          local_id: r.id,
          user_id: r.user_id,
          embedding: toVectorLiteral(vectors[j]),
          entry_date: r.created_at,
          updated_at: now,
        })),
        { onConflict: "local_id" }
      );
    if (error) {
      console.error("[embeddings] entry_index upsert failed:", error);
      failed += batch.length;
    } else {
      embedded += batch.length;
    }
  }

  return {
    scanned: entries.length,
    missing: missing.length,
    embedded,
    failed,
    remaining: missing.length - todo.length,
  };
}

/**
 * Backfill wektorów dla WSZYSTKICH kont (panel admina). Idempotentny.
 */
export async function backfillEmbeddings(
  options: Omit<BackfillOptions, "userId"> = {}
): Promise<BackfillResult> {
  return runBackfill(options);
}

/**
 * Backfill wektorów tylko dla jednego użytkownika. Gdy brak braków → szybki
 * no-op (dwa odczyty).
 */
export async function backfillEmbeddingsForUser(
  userId: string,
  options: Omit<BackfillOptions, "userId"> = {}
): Promise<BackfillResult> {
  return runBackfill({ ...options, userId });
}
