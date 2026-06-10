import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Czy integracja z Supabase jest skonfigurowana (obie zmienne env obecne).
 * Pozwala warstwie synchronizacji i logowania działać jako no-op, gdy apka
 * uruchamiana jest bez kluczy (np. w testach).
 */
export const isConfigured = Boolean(url && anonKey);

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
