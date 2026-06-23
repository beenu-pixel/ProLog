import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { getUserSubscription, isPersonaAllowed, type PlanTier } from "@/lib/plans";
import { THERAPISTS } from "@/lib/therapists";

// GET /api/plan — plan zalogowanego użytkownika: tier + status + data odnowienia +
// lista dostępnych person. Zasila przełącznik person (kłódki) oraz panel „Plan i
// płatności" w Ustawieniach. Tylko odczyt; twarde egzekwowanie i tak jest serwerowe.

export interface PlanResponse {
  tier: PlanTier;
  /** Surowy status subskrypcji (active/canceled/past_due/incomplete). */
  status: string;
  /** Koniec bieżącego okresu rozliczeniowego (ISO) lub null. */
  currentPeriodEnd: string | null;
  /** Czy istnieje klient Stripe (→ pokaż przycisk portalu zarządzania). */
  hasStripeCustomer: boolean;
  /** Czy subskrypcja jest zaplanowana do anulowania na koniec okresu. */
  cancelAtPeriodEnd: boolean;
  /** Id person dostępnych na tym planie (na free tylko Freud). */
  allowedPersonaIds: string[];
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  const sub = await getUserSubscription(auth.userId);
  const allowedPersonaIds = THERAPISTS.filter((t) =>
    isPersonaAllowed(sub.tier, t.id)
  ).map((t) => t.id);

  const body: PlanResponse = {
    tier: sub.tier,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    hasStripeCustomer: sub.hasStripeCustomer,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    allowedPersonaIds,
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
