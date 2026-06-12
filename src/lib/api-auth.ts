import { createHash } from "crypto";

import { supabaseAdmin, isAdminConfigured } from "@/lib/supabase-admin";

// Uwierzytelnianie Personal Access Tokenem dla endpointów /api/v1.
// Klient wysyła `Authorization: Bearer <token>`; w bazie trzymamy wyłącznie
// SHA-256 tokenu (`api_tokens.token_hash`). Odszukujemy wiersz po hashu i
// zwracamy `user_id`, którym dalej ręcznie filtrujemy zapytania service-role.

/** Hash tokenu (SHA-256 hex) — ten sam algorytm po stronie klienta przy zapisie. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Wynik uwierzytelnienia: id użytkownika albo gotowa odpowiedź błędu. */
export type AuthResult = { userId: string } | Response;

/** Czy zwrócony wynik to błąd (Response), a nie `{ userId }`. */
export function isAuthError(result: AuthResult): result is Response {
  return result instanceof Response;
}

function unauthorized(message: string): Response {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Weryfikuje surowy token (bez prefiksu „Bearer "): odnajduje użytkownika po
 * haszu w `api_tokens`. Zwraca `{ userId }` albo `null` (token nieznany/pusty).
 * Po sukcesie odświeża `last_used_at` w tle (fire-and-forget). Wymaga
 * skonfigurowanego service-role — w przeciwnym razie zwraca `null`.
 *
 * Współdzielone przez REST (`authenticate`) i serwer MCP (`withMcpAuth`).
 */
export async function verifyApiToken(
  token: string
): Promise<{ userId: string } | null> {
  if (!isAdminConfigured || !supabaseAdmin) return null;

  const trimmed = token.trim();
  if (!trimmed) return null;

  const tokenHash = hashToken(trimmed);
  const { data, error } = await supabaseAdmin
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) return null;

  // Odświeżenie znacznika ostatniego użycia — nie blokuje odpowiedzi.
  void supabaseAdmin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id as string)
    .then(undefined, () => {
      // best-effort — błąd aktualizacji nie może wpływać na żądanie
    });

  return { userId: data.user_id as string };
}

/**
 * Sprawdza nagłówek `Authorization`, odnajduje użytkownika po haszu tokenu.
 * Zwraca `{ userId }` albo `Response` (401/503) do natychmiastowego zwrócenia.
 * Po sukcesie odświeża `last_used_at` w tle (fire-and-forget).
 */
export async function authenticate(request: Request): Promise<AuthResult> {
  if (!isAdminConfigured || !supabaseAdmin) {
    return Response.json(
      { error: "API niedostępne — brak konfiguracji serwera (service-role)." },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return unauthorized("Brak tokenu. Użyj nagłówka: Authorization: Bearer <token>.");
  }

  const token = match[1].trim();
  if (!token) return unauthorized("Pusty token.");

  const result = await verifyApiToken(token);
  if (!result) {
    return unauthorized("Nieprawidłowy token.");
  }

  return result;
}
