import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { getUserPlan, isReportPeriodAllowed, type ReportPeriod } from "@/lib/plans";
import { generateReport } from "@/lib/services/reports";
import { logAiUsage } from "@/lib/services/ai-usage";
import { isApiError } from "@/lib/api-error";
import {
  enforceRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  RateLimitError,
} from "@/lib/services/rate-limit";

// POST /api/reports — raport nastroju i wątków za okres (funkcja Pro/Max).
// Body: { period: "week" | "month" }. Tygodniowy: Pro+, miesięczny: tylko Max.
// Dostęp tylko dla zalogowanych (sesja Supabase); zużycie liczone i logowane.

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  let body: { period?: string };
  try {
    body = (await request.json()) as { period?: string };
  } catch {
    return Response.json({ error: "Niepoprawne ciało żądania." }, { status: 400 });
  }

  const period = body.period;
  if (period !== "week" && period !== "month") {
    return Response.json(
      { error: "Pole `period` musi być 'week' albo 'month'." },
      { status: 400 }
    );
  }

  // Bramka planu (przed rate-limitem, by zablokowana próba nie zżerała puli).
  const plan = await getUserPlan(auth.userId);
  if (!isReportPeriodAllowed(plan, period as ReportPeriod)) {
    return Response.json(
      {
        error:
          period === "month"
            ? "Raport miesięczny jest dostępny w planie Max."
            : "Raporty są dostępne w planie Pro.",
        upgrade: true,
      },
      { status: 403 }
    );
  }

  let rl;
  try {
    rl = await enforceRateLimit(auth.userId, "reports");
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
    throw err;
  }

  try {
    const result = await generateReport(auth.userId, period as ReportPeriod);
    if (result.usage) {
      logAiUsage({
        userId: auth.userId,
        email: auth.email,
        endpoint: "reports",
        model: "grok-4.3",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
    }
    return Response.json(result, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    if (isApiError(err)) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
