import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { hybridSearch } from "@/lib/services/search";
import { isApiError } from "@/lib/api-error";
import { EmbeddingError } from "@/lib/services/embeddings";
import {
  enforceRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  RateLimitError,
} from "@/lib/services/rate-limit";

// POST /api/search — wyszukiwanie hybrydowe (wektor + full-text, RRF) + kontekst
// ostatnich N dni. Auth: sesja przeglądarki (JWT Supabase) jak /api/therapist —
// tryb dostępny tylko dla zalogowanych. Body:
//   { query: string, limit?: number, recentDays?: number }
// Odpowiedź: { hits: { entry, source }[] } — `source` ∈ search | recent | both.

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  let rl;
  try {
    rl = await enforceRateLimit(auth.userId, "search");
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

  const query = typeof body.query === "string" ? body.query : "";
  const limit = typeof body.limit === "number" ? body.limit : undefined;
  const recentDays = typeof body.recentDays === "number" ? body.recentDays : undefined;

  try {
    const hits = await hybridSearch(auth.userId, query, { limit, recentDays });
    return Response.json({ hits }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    if (isApiError(err) || err instanceof EmbeddingError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/search] unexpected:", err);
    return Response.json({ error: "Wyszukiwanie nie powiodło się." }, { status: 500 });
  }
}
