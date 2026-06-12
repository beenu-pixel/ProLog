import { supabase, isConfigured } from "@/lib/supabase";

// Klientowe zarządzanie Personal Access Tokenami. Pełny token powstaje i jest
// pokazywany TYLKO w przeglądarce — do bazy trafia wyłącznie jego SHA-256
// (`token_hash`) oraz krótki prefiks do wyświetlenia. Operacje przechodzą przez
// supabase-js na sesji użytkownika (RLS ogranicza do własnych wierszy).

export interface ApiToken {
  id: string;
  name: string | null;
  tokenPrefix: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const TOKEN_PREFIX = "plog_";

/** Surowy wiersz `public.api_tokens`. */
interface ApiTokenRow {
  id: string;
  name: string | null;
  token_prefix: string | null;
  created_at: string;
  last_used_at: string | null;
}

function fromRow(row: ApiTokenRow): ApiToken {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

/** Losowy, pełny token: `plog_` + 32 bajty w base64url. */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let base64 = btoa(String.fromCharCode(...bytes));
  base64 = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return TOKEN_PREFIX + base64;
}

/** SHA-256 (hex) — ten sam algorytm co serwerowy `hashToken` (na pełnym tokenie). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Lista tokenów zalogowanego użytkownika (najnowsze najpierw). */
export async function listTokens(): Promise<ApiToken[]> {
  if (!isConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, name, token_prefix, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as ApiTokenRow[]).map(fromRow);
}

export interface CreateTokenResult {
  /** Pełny token — pokazywany użytkownikowi JEDEN raz. */
  token: string;
  created: ApiToken;
}

/**
 * Tworzy token: generuje wartość, zapisuje jej hash + prefiks i zwraca pełny
 * token (do jednorazowego pokazania). Rzuca `Error` przy braku konfiguracji/sesji
 * lub błędzie zapisu.
 */
export async function createToken(name: string): Promise<CreateTokenResult> {
  if (!isConfigured || !supabase) {
    throw new Error("Brak konfiguracji Supabase.");
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Zaloguj się, aby wygenerować token.");

  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const tokenPrefix = token.slice(0, TOKEN_PREFIX.length + 6) + "…";

  const { data, error } = await supabase
    .from("api_tokens")
    .insert({
      user_id: userId,
      name: name.trim() || null,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
    })
    .select("id, name, token_prefix, created_at, last_used_at")
    .single();

  if (error || !data) {
    throw new Error("Nie udało się zapisać tokenu.");
  }
  return { token, created: fromRow(data as ApiTokenRow) };
}

/** Odwołuje (usuwa) token po id. */
export async function revokeToken(id: string): Promise<void> {
  if (!isConfigured || !supabase) return;
  await supabase.from("api_tokens").delete().eq("id", id);
}
