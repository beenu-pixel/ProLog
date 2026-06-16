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
  title: string;
  content: string;
}

export interface BackfillResult {
  scanned: number;
  embedded: number;
  failed: number;
}

/**
 * Uzupełnia embeddingi dla wpisów, które jeszcze ich nie mają (`embedding is null`).
 * Idempotentny i powtarzalny: ponowne wywołanie embeduje tylko nowe braki. Przetwarza
 * partiami; błąd jednej partii jest logowany i nie przerywa pozostałych. Wymaga
 * skonfigurowanego klucza sekretnego Supabase. `userId` zawęża do jednego konta
 * (gdy podany), inaczej obejmuje wszystkie konta.
 */
async function runBackfill(userId?: string): Promise<BackfillResult> {
  if (!supabaseAdmin) {
    throw new EmbeddingError("Brak konfiguracji serwera Supabase.", 503);
  }

  let query = supabaseAdmin
    .from("entries")
    .select("id, title, content")
    .is("embedding", null)
    .limit(10000);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;

  if (error) {
    console.error("[embeddings] select failed:", error);
    throw new EmbeddingError("Nie udało się pobrać wpisów do embeddowania.", 500);
  }

  const rows = (data ?? []) as BackfillRow[];
  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const inputs = batch.map((r) => buildEmbeddingInput(r.title, r.content));

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

    for (let j = 0; j < batch.length; j++) {
      const { error: updateError } = await supabaseAdmin
        .from("entries")
        .update({ embedding: toVectorLiteral(vectors[j]) })
        .eq("id", batch[j].id);
      if (updateError) {
        console.error("[embeddings] update failed:", batch[j].id, updateError);
        failed += 1;
      } else {
        embedded += 1;
      }
    }
  }

  return { scanned: rows.length, embedded, failed };
}

/**
 * Backfill embeddingów dla WSZYSTKICH kont (panel admina). Idempotentny.
 */
export async function backfillEmbeddings(): Promise<BackfillResult> {
  return runBackfill();
}

/**
 * Backfill embeddingów tylko dla jednego użytkownika. Używane best-effort przed
 * wyszukiwaniem hybrydowym — wpisy tworzone w UI (mirror localStorage→Supabase) nie
 * dostają embeddingu na bieżąco, więc tu domykamy braki. Gdy brak braków → szybki no-op.
 */
export async function backfillEmbeddingsForUser(
  userId: string
): Promise<BackfillResult> {
  return runBackfill(userId);
}
