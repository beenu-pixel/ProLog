import { supabase, isConfigured } from "@/lib/supabase";
import { isSeedEntry } from "@/lib/seed";
import type { Entry } from "@/lib/types";

/**
 * Warstwa „mirror": localStorage pozostaje reaktywnym źródłem prawdy dla UI,
 * a każdy zapis jest dodatkowo synchronizowany z **Supabase** (`public.entries`, źródło
 * prawdy treści) przez serwerowe route'y `/api/cms/entries`. Klucz sekretny zostaje na serwerze —
 * klient uwierzytelnia się sesją Supabase (JWT w nagłówku Authorization).
 *
 * Wszystkie funkcje są best-effort — nigdy nie blokują UI ani nie rzucają wyjątkiem.
 * Gdy brak konfiguracji/sesji, są no-opem (UX offline-first działa dalej lokalnie).
 */

/** Nagłówki z tokenem sesji Supabase albo `null` (brak sesji/konfiguracji). */
async function authHeaders(): Promise<Record<string, string> | null> {
  if (!isConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** Wypycha pojedynczy wpis na serwer (upsert po `id`). */
export function pushEntry(entry: Entry): void {
  void (async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch("/api/cms/entries", {
        method: "POST",
        headers,
        body: JSON.stringify({ entries: [entry] }),
      });
    } catch {
      // Mirror to najlepszy wysiłek — błąd sieci nie może psuć zapisu lokalnego.
    }
  })();
}

/**
 * Usuwa wpis na serwerze. Zwraca `true`, gdy usunięcie potwierdzone; `false` przy
 * braku sesji/konfiguracji lub błędzie. Wołający (storage) zdejmuje „nagrobek"
 * dopiero po potwierdzeniu — inaczej usunięty wpis mógłby wrócić przy `pullAll`.
 */
export async function deleteRemote(id: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch(`/api/cms/entries/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Pobiera wszystkie wpisy zalogowanego użytkownika z serwera. Best-effort: przy
 * braku sesji/konfiguracji lub błędzie zwraca pustą listę (nigdy nie rzuca).
 * Używane przy logowaniu/odświeżeniu, by localStorage dogonił stan z chmury
 * (również wpisy dodane w innej przeglądarce albo przez REST/MCP).
 */
export async function pullAll(): Promise<Entry[]> {
  try {
    const headers = await authHeaders();
    if (!headers) return [];
    const res = await fetch("/api/cms/entries", { method: "GET", headers });
    if (!res.ok) return [];
    const json = (await res.json()) as { entries?: Entry[] };
    return json.entries ?? [];
  } catch {
    return [];
  }
}

/**
 * Bulk-upsert wszystkich wpisów — wołane po zalogowaniu, by serwer dogonił stan
 * lokalny. Pomija wpisy-seedy (wypełniacz demonstracyjny) — nie należą do konta.
 */
export function pushAll(entries: Entry[]): void {
  const real = entries.filter((entry) => !isSeedEntry(entry));
  if (real.length === 0) return;
  void (async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch("/api/cms/entries", {
        method: "POST",
        headers,
        body: JSON.stringify({ entries: real }),
      });
    } catch {
      // jw.
    }
  })();
}
