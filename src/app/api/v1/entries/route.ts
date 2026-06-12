import { authenticate, isAuthError } from "@/lib/api-auth";
import { createEntry } from "@/lib/services/entries";
import { isApiError } from "@/lib/api-error";

// POST /api/v1/entries — dodanie nowego wpisu.
// Auth: Authorization: Bearer <PAT>. Body:
//   { content: string, date?: "YYYY-MM-DD",
//     mood?, sleep?, energy?, productivity?, stress?: 1..5 }
// `date` domyślnie dziś (Europe/Warsaw); tytuł generowany z treści.
// Logika walidacji/zapisu współdzielona z MCP w `@/lib/services/entries`.

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isAuthError(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Niepoprawne ciało żądania (JSON)." }, { status: 400 });
  }

  try {
    const entry = await createEntry(auth.userId, body);
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    if (isApiError(err)) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
