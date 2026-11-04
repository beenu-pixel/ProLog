import { authenticateUser, isUserAuthError, isAdminEmail } from "@/lib/user-auth";
import { backfillEmbeddings, EmbeddingError } from "@/lib/services/embeddings";

// Backfill embeddingów wpisów: liczy i zapisuje wektor dla każdego wpisu, który
// jeszcze go nie ma. Idempotentny — można uruchamiać wielokrotnie (uzupełnia tylko
// braki). Dostęp tylko dla właściciela (PROLOG_ADMIN_EMAILS), bo proces dotyka
// WSZYSTKICH kont (czyta kluczem sekretnym, omijając RLS) i zużywa kredyty OpenAI.
//
// Wektory trafiają do `entry_index` (z niej czyta wyszukiwanie). Jedno wywołanie
// przetwarza najwyżej `?maxPerRun=` braków (domyślnie 500, max 2000) partiami po 64;
// gdy w odpowiedzi `remaining > 0`, wystarczy wywołać ponownie.

// Partia = jedno żądanie do OpenAI (~1–2 s) + jeden upsert; 500 braków to ~8 partii.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  if (!isAdminEmail(auth.email)) {
    return Response.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const raw = new URL(request.url).searchParams.get("maxPerRun");
    const maxPerRun = raw !== null && /^\d+$/.test(raw) ? Number(raw) : undefined;
    const result = await backfillEmbeddings({ maxPerRun });
    return Response.json(result);
  } catch (err) {
    if (err instanceof EmbeddingError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/backfill-embeddings] unexpected:", err);
    return Response.json({ error: "Backfill nie powiódł się." }, { status: 500 });
  }
}
