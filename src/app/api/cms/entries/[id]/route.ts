import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { deleteEntryByLocalId } from "@/lib/services/cms-entries";
import { deleteEntryIndex } from "@/lib/services/entry-index";

// Usuwanie pojedynczego wpisu po `localId` (= id z localStorage). Auth sesją Supabase.

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  const { id } = await params;
  try {
    const ok = await deleteEntryByLocalId(auth.userId, id);
    await deleteEntryIndex(id);
    return Response.json({ ok });
  } catch (err) {
    console.error("[api/cms/entries/[id]] DELETE failed:", err);
    return Response.json({ error: "Nie udało się usunąć wpisu." }, { status: 502 });
  }
}
