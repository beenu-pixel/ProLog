import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/keep-alive — wołany dwa razy dziennie przez Vercel Cron (vercel.json).
// Darmowy projekt Supabase usypia się po ~7 dniach bez aktywności bazy. Sam
// odczyt nie wystarcza: przy codziennym count na entries i tak przyszło
// ostrzeżenie o uśpieniu (01.10.2026), więc robimy prawdziwy ZAPIS — wiersz
// w `keep_alive` — i sprzątamy wiersze starsze niż 30 dni. Auth: Vercel
// dokleja `Authorization: Bearer <CRON_SECRET>`, gdy zmienna jest ustawiona.

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return Response.json({ error: "Brak konfiguracji Supabase." }, { status: 503 });
  }

  const { error } = await supabaseAdmin
    .from("keep_alive")
    .insert({ pinged_at: new Date().toISOString() });
  if (error) {
    console.error("[api/keep-alive] ping failed:", error);
    return Response.json({ ok: false }, { status: 502 });
  }

  // Sprzątanie jest drugorzędne — ping już się udał, błąd tylko logujemy.
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  const { error: pruneError } = await supabaseAdmin
    .from("keep_alive")
    .delete()
    .lt("pinged_at", cutoff);
  if (pruneError) console.error("[api/keep-alive] prune failed:", pruneError);

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
