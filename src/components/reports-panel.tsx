"use client";

import { useState } from "react";
import { Lock, Sparkles, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/auth";
import { usePlan } from "@/hooks/use-plan";

type Period = "week" | "month";

interface ReportData {
  period: Period;
  entryCount: number;
  summary: string;
}

const PERIOD_LABEL: Record<Period, string> = {
  week: "tygodniowy",
  month: "miesięczny",
};

/**
 * Panel raportów AI (funkcja Pro/Max) na ekranie Statystyk. Tygodniowy jest od
 * planu Pro, miesięczny tylko w Max. Dla planu bez dostępu przycisk pokazuje kłódkę
 * i prowadzi do cennika. Twarde egzekwowanie jest serwerowe (/api/reports) — tu
 * tylko UX: dostęp wyliczamy z `usePlan` (gość/nieznany plan → kłódki, bez blokady żądania).
 */
export function ReportsPanel() {
  const plan = usePlan();
  const tier = plan?.tier ?? null;
  const canWeek = tier === "pro" || tier === "max";
  const canMonth = tier === "max";

  const [loading, setLoading] = useState<Period | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (period: Period) => {
    const allowed = period === "week" ? canWeek : canMonth;
    if (!allowed) {
      window.location.assign("/pricing");
      return;
    }
    setLoading(period);
    setError(null);
    setReport(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        window.location.assign("/welcome?next=/stats");
        return;
      }
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ period }),
      });
      const data = (await res.json()) as ReportData & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Nie udało się wygenerować raportu.");
        return;
      }
      setReport(data);
    } catch {
      setError("Coś poszło nie tak. Spróbuj ponownie.");
    } finally {
      setLoading(null);
    }
  };

  const renderButton = (period: Period, locked: boolean) => (
    <button
      key={period}
      type="button"
      onClick={() => generate(period)}
      disabled={loading !== null}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        "hover:bg-secondary disabled:opacity-60"
      )}
      title={locked ? "Dostępne w wyższym planie — kliknij, by zobaczyć cennik" : undefined}
    >
      {loading === period ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : locked ? (
        <Lock className="size-3.5 text-muted-foreground" />
      ) : (
        <Sparkles className="size-3.5 text-muted-foreground" />
      )}
      Raport {PERIOD_LABEL[period]}
    </button>
  );

  return (
    <section className="space-y-3 rounded-2xl border p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Raporty AI
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Podsumowanie nastroju, korelacji i powracających wątków z Twoich wpisów.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {renderButton("week", !canWeek)}
        {renderButton("month", !canMonth)}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {report && (
        <div className="rounded-xl bg-secondary/50 p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Raport {PERIOD_LABEL[report.period]} · {report.entryCount}{" "}
            {report.entryCount === 1 ? "wpis" : "wpisów"}
          </p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {report.summary}
          </div>
        </div>
      )}
    </section>
  );
}
