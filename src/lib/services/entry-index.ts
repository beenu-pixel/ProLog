import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildEmbeddingInput, embedText } from "@/lib/services/embeddings";

// Indeks wyszukiwania w Supabase: per wpis tylko embedding + link do Strapi
// (tabela `public.entry_index`). Treść = Strapi (źródło prawdy); tu trzymamy wektor,
// by zachować wyszukiwanie wektorowe (RAG terapeuty). Wszystkie operacje best-effort —
// błąd indeksu nie może wywrócić zapisu wpisu w Strapi.

/** Upsert wiersza indeksu. Embedding liczony best-effort; gdy padnie → wiersz bez wektora (zostaje link + data). */
export async function upsertEntryIndex(params: {
  localId: string;
  strapiDocId: string;
  userId: string;
  title: string;
  content: string;
  entryDate: string;
}): Promise<void> {
  if (!supabaseAdmin) return;

  let embedding: string | null = null;
  try {
    const vector = await embedText(buildEmbeddingInput(params.title, params.content));
    embedding = JSON.stringify(vector);
  } catch (err) {
    console.error("[entry-index] embedding failed (zostawiam link bez wektora):", err);
  }

  const { error } = await supabaseAdmin.from("entry_index").upsert({
    local_id: params.localId,
    strapi_doc_id: params.strapiDocId,
    user_id: params.userId,
    embedding,
    entry_date: params.entryDate,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("[entry-index] upsert failed:", error);
}

/** Usuwa wiersz indeksu (po localId). */
export async function deleteEntryIndex(localId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from("entry_index").delete().eq("local_id", localId);
  if (error) console.error("[entry-index] delete failed:", error);
}

export type EntryMatch = {
  localId: string;
  strapiDocId: string | null;
  entryDate: string | null;
  similarity: number;
};

/** Wyszukiwanie wektorowe (RPC match_entries) — zwraca dopasowane id wpisów. */
export async function matchEntries(
  userId: string,
  queryEmbedding: number[],
  matchCount = 30
): Promise<EntryMatch[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.rpc("match_entries", {
    p_user_id: userId,
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: matchCount,
  });
  if (error) {
    console.error("[entry-index] match_entries failed:", error);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    localId: r.local_id as string,
    strapiDocId: (r.strapi_doc_id as string) ?? null,
    entryDate: (r.entry_date as string) ?? null,
    similarity: Number(r.similarity ?? 0),
  }));
}

/** Wpisy z ostatnich `days` dni (kontekst recency dla RAG). */
export async function recentEntryRefs(
  userId: string,
  days: number,
  limit = 50
): Promise<EntryMatch[]> {
  if (!supabaseAdmin) return [];
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("entry_index")
    .select("local_id, strapi_doc_id, entry_date")
    .eq("user_id", userId)
    .gte("entry_date", since)
    .order("entry_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[entry-index] recent select failed:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    localId: r.local_id as string,
    strapiDocId: (r.strapi_doc_id as string) ?? null,
    entryDate: (r.entry_date as string) ?? null,
    similarity: 0,
  }));
}
