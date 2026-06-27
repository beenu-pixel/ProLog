import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { listEntriesByUser, upsertEntry } from "@/lib/services/cms-entries";
import { upsertEntryIndex } from "@/lib/services/entry-index";
import type { Entry } from "@/lib/types";

// Serwerowy proxy do Strapi dla wpisów dziennika. Klient (warstwa sync) woła te
// route'y zamiast pisać wprost do bazy — token Strapi zostaje na serwerze.
// Auth: sesja Supabase (JWT) → `userId` właściciela wpisów.

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

  let body: { entries?: Entry[] };
  try {
    body = (await request.json()) as { entries?: Entry[] };
  } catch {
    return Response.json({ error: "Niepoprawny JSON." }, { status: 400 });
  }

  const list = Array.isArray(body?.entries) ? body.entries : [];
  if (list.length === 0) return Response.json({ entries: [] });

  try {
    const saved = [];
    for (const entry of list) {
      const cms = await upsertEntry(auth.userId, entry);
      saved.push(cms);
      // Indeks wektorowy (embedding + link) — best-effort, nie blokuje zapisu treści.
      await upsertEntryIndex({
        localId: cms.id,
        strapiDocId: cms.strapiDocId,
        userId: auth.userId,
        title: cms.title,
        content: cms.content,
        entryDate: cms.createdAt,
      });
    }
    return Response.json({ entries: saved });
  } catch (err) {
    console.error("[api/cms/entries] POST failed:", err);
    return Response.json({ error: "Nie udało się zapisać wpisu." }, { status: 502 });
  }
}
