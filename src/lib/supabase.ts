import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Czy integracja z Supabase jest skonfigurowana (obie zmienne env obecne).
 * Pozwala warstwie synchronizacji i logowania działać jako no-op, gdy apka
 * uruchamiana jest bez kluczy (np. w testach).
 */
export const isConfigured = Boolean(url && anonKey);

// Diagnostyka: gdy bundle wyszedł bez publicznych zmiennych, logujemy DOKŁADNIE
// czego brakuje. Tylko w przeglądarce i tylko nazwy zmiennych (są publiczne —
// żadnego sekretu tu nie ma), by nie zaśmiecać logów builda/SSR. Bez tego jedyny
// sygnał to lakoniczne „brak konfiguracji" na ekranie logowania — a na produkcji
// ciężko wtedy zgadnąć, że to kwestia envów wpalanych w build (i starego cache).
if (!isConfigured && typeof window !== "undefined") {
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);
  console.error(
    `[supabase] Brak konfiguracji — logowanie i synchronizacja wyłączone. ` +
      `Brakuje: ${missing.join(", ")}. To zmienne NEXT_PUBLIC_* wpalane w build — ` +
      `ten bundle zbudowano bez nich (sprawdź env w Vercel i zrób redeploy; ` +
      `jeśli env są, wyczyść cache przeglądarki — możesz mieć stary bundle).`
  );
}

/**
 * Pojedynczy klient przeglądarkowy. Sesję (i jej odświeżanie) obsługuje sam
 * supabase-js, trzymając ją w localStorage; `detectSessionInUrl` przejmuje
 * token po powrocie z OAuth Google.
 */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
