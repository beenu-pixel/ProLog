import { supabaseAdmin } from "@/lib/supabase-admin";

// Log zużycia AI — jeden wiersz `ai_usage` na każde wywołanie funkcji AI
// (transkrypcja, terapeuta, agent API, raporty). Zapis przez klucz sekretny (omija
// RLS). Best-effort: błąd logowania nie może wpływać na odpowiedź użytkownikowi.

export type AiEndpoint = "transcribe" | "therapist" | "api_agent" | "reports";

export interface AiUsageInput {
  userId: string;
  /** E-mail konta (gdy znany od razu, np. z `authenticateUser`). */
  email?: string | null;
  endpoint: AiEndpoint;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

/**
 * Zapisuje zużycie AI w tle (fire-and-forget). Gdy `email` nie podano (np. ścieżka
 * agenta zna tylko `userId`), próbujemy go doczytać z Auth — też best-effort.
 */
export function logAiUsage(input: AiUsageInput): void {
  if (!supabaseAdmin) return;

  void (async () => {
    try {
      let email = input.email ?? null;
      if (!email) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(input.userId);
        email = data.user?.email ?? null;
      }

      await supabaseAdmin.from("ai_usage").insert({
        user_id: input.userId,
        user_email: email,
        endpoint: input.endpoint,
        model: input.model ?? null,
        input_tokens: input.inputTokens ?? null,
        output_tokens: input.outputTokens ?? null,
      });
    } catch {
      // best-effort — log nie może wywrócić właściwej odpowiedzi
    }
  })();
}
