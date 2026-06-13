import { supabaseAdmin, isAdminConfigured } from "@/lib/supabase-admin";

// Uwierzytelnianie SESJĄ przeglądarki (JWT Supabase) dla wewnętrznych endpointów
// AI: /api/transcribe i /api/therapist. To NIE jest Personal Access Token (zob.
// api-auth.ts) — tu klient dosyła `Authorization: Bearer <access_token>` z aktywnej
// sesji supabase-js, a serwer waliduje go przez `auth.getUser(token)` (sprawdza
// podpis JWT w usłudze Auth i zwraca usera). Dzięki temu funkcje AI działają tylko
// dla zalogowanych, a każde wywołanie jest przypisane do konkretnego konta.

/** Wynik uwierzytelnienia: dane użytkownika albo gotowa odpowiedź błędu. */
export type UserAuthResult = { userId: string; email: string | null } | Response;

/** Czy zwrócony wynik to błąd (Response), a nie dane użytkownika. */
export function isUserAuthError(result: UserAuthResult): result is Response {
  return result instanceof Response;
}

function unauthorized(message: string): Response {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Sprawdza nagłówek `Authorization: Bearer <token>` jako token sesji Supabase.
 * Zwraca `{ userId, email }` albo `Response` (401/503) do natychmiastowego zwrócenia.
 */
export async function authenticateUser(request: Request): Promise<UserAuthResult> {
  if (!isAdminConfigured || !supabaseAdmin) {
    return Response.json(
      { error: "Usługa niedostępna — brak konfiguracji serwera." },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return unauthorized("Wymagane logowanie.");
  }

  const token = match[1].trim();
  if (!token) return unauthorized("Wymagane logowanie.");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return unauthorized("Sesja wygasła lub jest nieprawidłowa. Zaloguj się ponownie.");
  }

  return { userId: data.user.id, email: data.user.email ?? null };
}

/**
 * Lista adresów e-mail z uprawnieniami właściciela (podgląd zużycia wszystkich kont).
 * Konfigurowalna przez `PROLOG_ADMIN_EMAILS` (rozdzielone przecinkami); domyślnie
 * właściciel projektu.
 */
function adminEmails(): string[] {
  const raw = process.env.PROLOG_ADMIN_EMAILS ?? "biniu108@gmail.com";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Czy dany e-mail ma uprawnienia właściciela (panel zużycia). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
