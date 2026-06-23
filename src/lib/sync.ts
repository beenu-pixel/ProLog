import { supabase, isConfigured } from "@/lib/supabase";
import { isSeedEntry } from "@/lib/seed";
import type { Entry, EntryPhoto } from "@/lib/types";

/**
 * Warstwa „mirror": localStorage pozostaje reaktywnym źródłem prawdy dla UI,
 * a każdy zapis jest dodatkowo wypychany do Supabase pod `user_id` zalogowanego
 * użytkownika. Wszystkie funkcje są fire-and-forget — nigdy nie blokują UI ani
 * nie rzucają wyjątkiem. Gdy brak konfiguracji lub sesji, są no-opem.
 */

/** Surowy wiersz tabeli `public.entries` (snake_case, metryki mogą być null). */
interface EntryRow {
  id: string;
  title: string;
  content: string;
  mood: number | null;
  sleep: number | null;
  energy: number | null;
  productivity: number | null;
  stress: number | null;
  photos: EntryPhoto[] | null;
  created_at: string;
  updated_at: string | null;
}

/** Mapuje wiersz bazy na `Entry` (null → undefined, snake_case → camelCase). */
function fromRow(row: EntryRow): Entry {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    mood: row.mood ?? undefined,
    sleep: row.sleep ?? undefined,
    energy: row.energy ?? undefined,
    productivity: row.productivity ?? undefined,
    stress: row.stress ?? undefined,
    photos: row.photos ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  } as Entry;
}

/** Wiersz tabeli `public.entries` (snake_case + user_id z sesji). */
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

/** Id zalogowanego użytkownika lub null (brak sesji / konfiguracji). */
async function currentUserId(): Promise<string | null> {
  if (!isConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Wypycha pojedynczy wpis (upsert po kluczu głównym `id`). */
export function pushEntry(entry: Entry): void {
  void (async () => {
    try {
      const userId = await currentUserId();
      if (!userId) return;
      await supabase!.from("entries").upsert(toRow(entry, userId));
    } catch {
      // Mirror to najlepszy wysiłek — błąd sieci nie może psuć zapisu lokalnego.
    }
  })();
}

/**
 * Usuwa wpis z bazy (RLS i tak ogranicza do własnych wierszy). Zwraca `true`,
 * gdy usunięcie zostało potwierdzone przez bazę; `false` przy braku sesji/
 * konfiguracji lub błędzie sieci. Wołający (storage) używa tego, by zdjąć
 * „nagrobek" dopiero po potwierdzeniu — inaczej usunięty wpis mógłby wrócić
 * przy następnym `pullAll`/`mergeRemoteEntries`.
 */
export async function deleteRemote(id: string): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const { error } = await supabase!.from("entries").delete().eq("id", id);
    return !error;
  } catch {
    // jw. — usunięcie lokalne już się powiodło; chmurę dogonimy przy logowaniu.
    return false;
  }
}

/**
 * Pobiera wszystkie wpisy zalogowanego użytkownika z bazy. Best-effort: przy
 * braku sesji/konfiguracji lub błędzie sieci zwraca pustą listę (nigdy nie
 * rzuca). Używane przy logowaniu, by localStorage dogonił stan z chmury.
 */
export async function pullAll(): Promise<Entry[]> {
  try {
    const userId = await currentUserId();
    if (!userId) return [];
    const { data, error } = await supabase!
      .from("entries")
      .select("*")
      .eq("user_id", userId);
    if (error || !data) return [];
    return (data as EntryRow[]).map(fromRow);
  } catch {
    return [];
  }
}

/**
 * Bulk-upsert wszystkich wpisów — wołane po zalogowaniu, by baza dogoniła stan
 * lokalny. Pomija wpisy-seedy (wypełniacz demonstracyjny) — te nie należą do
 * konta użytkownika i nie powinny trafiać do bazy.
 */
export function pushAll(entries: Entry[]): void {
  const real = entries.filter((entry) => !isSeedEntry(entry));
  if (real.length === 0) return;
  void (async () => {
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const rows = real.map((entry) => toRow(entry, userId));
      await supabase!.from("entries").upsert(rows);
    } catch {
      // jw.
    }
  })();
}
