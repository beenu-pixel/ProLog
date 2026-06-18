import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { getLimitsFor } from "@/lib/services/rate-limit";

// GET /api/limits — bieżący stan dziennych limitów AI dla zalogowanego użytkownika
// (per bucket: limit, used, remaining, resetAt). Pozwala UI wyłączyć przyciski i
// pokazać ostrzeżenie ZANIM użytkownik spali kosztowne wywołanie. Tylko odczyt —
// nie rejestruje żadnego wywołania.

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  const limits = await getLimitsFor(auth.userId);
  return Response.json({ limits }, { headers: { "Cache-Control": "no-store" } });
}
