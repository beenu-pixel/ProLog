import { authenticate, isAuthError } from "@/lib/api-auth";
import { askAgent } from "@/lib/services/agent";
import { isApiError } from "@/lib/api-error";
import {
  enforceRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  RateLimitError,
} from "@/lib/services/rate-limit";

// POST /api/v1/agent — pytanie do cyfrowego terapeuty (Freud) nad dziennikiem.
// Auth: Authorization: Bearer <PAT>. Body:
//   { question: string, day?: "YYYY-MM-DD", from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" }
// Odpowiedź: JSON { answer, day } (bez streamingu).
// Logika kontekstu/modelu współdzielona z MCP w `@/lib/services/agent`.

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isAuthError(auth)) return auth;

  let rl;
  try {
    rl = await enforceRateLimit(auth.userId, "api_agent");
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
    throw err;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Niepoprawne ciało żądania (JSON)." }, { status: 400 });
  }

  try {
    const result = await askAgent(auth.userId, body);
    return Response.json(result, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    if (isApiError(err)) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
