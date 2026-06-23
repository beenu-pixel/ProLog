import { authenticate, isAuthError } from "@/lib/api-auth";
import { getEntriesForDay } from "@/lib/services/entries";
import { isApiError } from "@/lib/api-error";
import {
  enforceRateLimit,
  rateLimitResponse,
  RateLimitError,
} from "@/lib/services/rate-limit";

// GET /api/v1/entries/[date] — wpis(y) zalogowanego użytkownika na dany dzień.
// `date` = "YYYY-MM-DD" (Europe/Warsaw). Może być wiele wpisów; zwraca listę.
// Logika odczytu współdzielona z MCP w `@/lib/services/entries`.

export async function GET(
  request: Request,
  ctx: { params: Promise<{ date: string }> }
): Promise<Response> {
  const auth = await authenticate(request);
  if (isAuthError(auth)) return auth;

  // Lekki limit anty-abuse na narzędziach danych (jednolity dla wszystkich planów).
  try {
    await enforceRateLimit(auth.userId, "api_data");
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
    throw err;
  }

  const { date } = await ctx.params;
  try {
    const result = await getEntriesForDay(auth.userId, date);
    return Response.json(result);
  } catch (err) {
    if (isApiError(err)) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
