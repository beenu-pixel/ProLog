import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Entry, EntryPhoto } from "@/lib/types";

// Serwis wpisów dziennika w Supabase (tabela `public.entries` = źródło prawdy).
// Wołany WYŁĄCZNIE po stronie serwera — kluczem sekretnym, z ręcznym filtrem po
// `user_id` w każdym zapytaniu. Klient rozmawia z nim przez route'y /api/cms/entries.
//
// Mapowanie: `Entry.id` ↔ `id` (UUID z localStorage), `Entry.createdAt` ↔ `created_at`.

type EntryRow = {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  mood: number | null;
  sleep: number | null;
  energy: number | null;
  productivity: number | null;
  stress: number | null;
  photos: EntryPhoto[] | null;
  created_at: string;
  updated_at: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS =
  "id, user_id, title, content, mood, sleep, energy, productivity, stress, photos, created_at, updated_at";

function db() {
  if (!supabaseAdmin) {
    throw new Error("Brak konfiguracji NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.");
  }
  return supabaseAdmin;
}

function toEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    title: r.title,
    content: r.content ?? "",
    mood: (r.mood ?? undefined) as Entry["mood"],
    sleep: (r.sleep ?? undefined) as Entry["sleep"],
    energy: (r.energy ?? undefined) as Entry["energy"],
    productivity: (r.productivity ?? undefined) as Entry["productivity"],
    stress: (r.stress ?? undefined) as Entry["stress"],
    photos: r.photos ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? undefined,
  };
}

function toRow(entry: Entry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    title: entry.title,
    content: entry.content,
    mood: entry.mood ?? null,
    sleep: entry.sleep ?? null,
    energy: entry.energy ?? null,
    productivity: entry.productivity ?? null,
    stress: entry.stress ?? null,
    photos: entry.photos ?? [],
    created_at: entry.createdAt,
    updated_at: entry.updatedAt ?? null,
  };
}

/** Wszystkie wpisy użytkownika, od najnowszych (stronicowanie po 1000). */
export async function listEntriesByUser(userId: string): Promise<Entry[]> {
  const out: Entry[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from("entries")
      .select(COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`entries list: ${error.message}`);
    out.push(...(data as EntryRow[]).map(toEntry));
    if (data.length < PAGE) break;
  }
  return out;
}

/** Upsert wpisu po `id`. Wpis o tym id należący do innego użytkownika nie zostanie nadpisany. */
export async function upsertEntry(userId: string, entry: Entry): Promise<Entry> {
  const { data: existing, error: findError } = await db()
    .from("entries")
    .select("user_id")
    .eq("id", entry.id)
    .maybeSingle();
  if (findError) throw new Error(`entries find: ${findError.message}`);
  if (existing && existing.user_id !== userId) {
    throw new Error("entries upsert: id należy do innego użytkownika.");
  }

  const { data, error } = await db()
    .from("entries")
    .upsert(toRow(entry, userId), { onConflict: "id" })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`entries upsert: ${error.message}`);
  return toEntry(data as EntryRow);
}

/** Usuwa wpis po `id`. Zwraca `false`, gdy wpis nie istniał. */
export async function deleteEntryByLocalId(userId: string, localId: string): Promise<boolean> {
  // `id` to kolumna uuid — inny format nie może istnieć, a rzuciłby błąd rzutowania.
  if (!UUID_RE.test(localId)) return false;
  const { data, error } = await db()
    .from("entries")
    .delete()
    .eq("user_id", userId)
    .eq("id", localId)
    .select("id");
  if (error) throw new Error(`entries delete: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Wpisy z danego zakresu dat (po `created_at`) — dla REST `/api/v1/entries/[date]` i raportów. */
export async function getEntriesByDateRange(
  userId: string,
  startIso: string,
  endIso: string
): Promise<Entry[]> {
  const { data, error } = await db()
    .from("entries")
    .select(COLUMNS)
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`entries range: ${error.message}`);
  return (data as EntryRow[]).map(toEntry);
}

/** Pobiera wpisy po zbiorze `id` (dla RAG — treść do kontekstu). */
export async function getEntriesByLocalIds(userId: string, localIds: string[]): Promise<Entry[]> {
  if (localIds.length === 0) return [];
  const { data, error } = await db()
    .from("entries")
    .select(COLUMNS)
    .eq("user_id", userId)
    .in("id", localIds);
  if (error) throw new Error(`entries by ids: ${error.message}`);
  return (data as EntryRow[]).map(toEntry);
}
