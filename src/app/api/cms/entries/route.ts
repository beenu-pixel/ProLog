import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { listEntriesByUser, upsertEntry } from "@/lib/services/journal-entries";
import { upsertEntryIndex } from "@/lib/services/entry-index";
import {
  enforceRateLimit,
  rateLimitResponse,
  RateLimitError,
} from "@/lib/services/rate-limit";
import { sanitizeEntryHtml } from "@/lib/sanitize";
import type { Entry } from "@/lib/types";

// Serwerowe API wpisów dziennika (źródło prawdy: Supabase `public.entries`). Klient
// (warstwa sync) woła te route'y zamiast pisać wprost do bazy — klucz sekretny zostaje
// na serwerze. Ścieżka `/api/cms` to pozostałość po Strapi (zachowana dla zgodności).
// Auth: sesja Supabase (JWT) → `userId` właściciela wpisów.

// Maksymalna liczba wpisów w jednym żądaniu bulk (anty-abuse; chroni przed
// gigantycznym payloadem i lawiną wywołań embeddingu).
const MAX_BULK = 500;

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;
  try {
    const entries = await listEntriesByUser(auth.userId);
    return Response.json({ entries });
  } catch (err) {
    console.error("[api/cms/entries] GET failed:", err);
    return Response.json({ error: "Nie udało się pobrać wpisów." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  // Anty-abuse: zapisy też limitujemy (każdy upsert liczy embedding OpenAI →
  // koszt). Bucket `api_data` — te same progi na każdym planie (dostępu do
  // własnych danych nie zamykamy za paywallem).
  try {
    await enforceRateLimit(auth.userId, "api_data");
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
    throw err;
  }

  let body: { entries?: Entry[] };
  try {
    body = (await request.json()) as { entries?: Entry[] };
  } catch {
    return Response.json({ error: "Niepoprawny JSON." }, { status: 400 });
  }

  const list = Array.isArray(body?.entries) ? body.entries : [];
  if (list.length === 0) return Response.json({ entries: [] });
  if (list.length > MAX_BULK) {
    return Response.json(
      { error: `Za dużo wpisów w jednym żądaniu (max ${MAX_BULK}).` },
      { status: 400 }
    );
  }

  try {
    const saved = [];
    for (const entry of list) {
      // Sanityzacja treści na granicy zapisu (defense-in-depth) — treść to HTML
      // z edytora; render też sanityzuje, ale nie trzymamy w bazie surowego markup.
      const clean: Entry = { ...entry, content: sanitizeEntryHtml(entry.content ?? "") };
      const stored = await upsertEntry(auth.userId, clean);
      saved.push(stored);
      // Indeks wektorowy (embedding) — best-effort, nie blokuje zapisu treści.
      await upsertEntryIndex({
        localId: stored.id,
        userId: auth.userId,
        title: stored.title,
        content: stored.content,
        entryDate: stored.createdAt,
      });
    }
    return Response.json({ entries: saved });
  } catch (err) {
    console.error("[api/cms/entries] POST failed:", err);
    return Response.json({ error: "Nie udało się zapisać wpisu." }, { status: 502 });
  }
}
