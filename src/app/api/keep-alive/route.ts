import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/keep-alive — wołany raz dziennie przez Vercel Cron (vercel.json).
// Darmowy projekt Supabase usypia się po ~7 dniach bez aktywności bazy; jedno
// lekkie zapytanie dziennie utrzymuje go przy życiu. Auth: Vercel dokleja
// `Authorization: Bearer <CRON_SECRET>`, gdy zmienna CRON_SECRET jest ustawiona.

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return Response.json({ error: "Brak konfiguracji Supabase." }, { status: 503 });
  }

  const { error } = await supabaseAdmin
    .from("entries")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("[api/keep-alive] ping failed:", error);
    return Response.json({ ok: false }, { status: 502 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
