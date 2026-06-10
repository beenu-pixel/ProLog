import { supabase, isConfigured } from "@/lib/supabase";
import { isSeedEntry } from "@/lib/seed";
import type { Entry } from "@/lib/types";

/**
 * Warstwa „mirror": localStorage pozostaje reaktywnym źródłem prawdy dla UI,
 * a każdy zapis jest dodatkowo wypychany do Supabase pod `user_id` zalogowanego
 * użytkownika. Wszystkie funkcje są fire-and-forget — nigdy nie blokują UI ani
 * nie rzucają wyjątkiem. Gdy brak konfiguracji lub sesji, są no-opem.
 */

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

/** Usuwa wpis z bazy (RLS i tak ogranicza do własnych wierszy). */
export function deleteRemote(id: string): void {
  void (async () => {
    try {
      const userId = await currentUserId();
      if (!userId) return;
      await supabase!.from("entries").delete().eq("id", id);
    } catch {
      // jw. — usunięcie lokalne już się powiodło.
    }
  })();
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
