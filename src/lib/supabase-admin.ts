import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Serwerowy klient z kluczem sekretnym — TYLKO po stronie serwera (route
// handlery /api/v1 oraz serwer MCP /api/mcp). Personal Access Token nie jest
// tokenem JWT Supabase, więc nie napędzi RLS; endpointy odszukują użytkownika
// po tokenie i operują na danych kluczem sekretnym, ręcznie filtrując po
// `user_id`.
//
// Klucz: nowy Supabase secret key `sb_secret_…` w `SUPABASE_SECRET_KEY`
// (zastępuje wycofywany `service_role`). Dla zgodności wstecznej (lokalny
// .env.local) akceptujemy też starszy `SUPABASE_SERVICE_ROLE_KEY`. Zawsze
// SEKRET — nigdy z prefiksem `NEXT_PUBLIC_`, nigdy do przeglądarki.

/** Wartość env-a, ale pusty/biały string traktujemy jak brak (→ fallback). */
const env = (value: string | undefined): string | undefined =>
  value && value.trim() ? value : undefined;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  env(process.env.SUPABASE_SECRET_KEY) ??
  env(process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Czy dostęp serwerowy jest skonfigurowany (URL + klucz sekretny). */
export const isAdminConfigured = Boolean(url && secretKey);

/**
 * Pojedynczy klient serwerowy (klucz sekretny). Bez sesji (stateless) — każde
 * żądanie API jest niezależne. `null`, gdy brak konfiguracji (endpointy
 * zwracają wtedy 503).
 */
export const supabaseAdmin: SupabaseClient | null = isAdminConfigured
  ? createClient(url!, secretKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
