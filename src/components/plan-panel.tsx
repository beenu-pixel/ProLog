"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAccessToken } from "@/lib/auth";
import { usePlan } from "@/hooks/use-plan";

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
};

const STATUS_LABEL: Record<string, string> = {
  active: "aktywny",
  canceled: "anulowany",
  past_due: "zaległa płatność",
  incomplete: "niedokończony",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Panel „Plan i płatności" w Ustawieniach: bieżący plan, status i data odnowienia,
 * przejście do cennika oraz (dla płacących) portal Stripe do zarządzania subskrypcją.
 * Czyta stan z `usePlan` (/api/plan). Plan ustawia wyłącznie webhook — to tylko widok.
 */
export function PlanPanel() {
  const plan = usePlan();
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = plan?.tier ?? "free";
  const isPaid = tier === "pro" || tier === "max";
  const renewal = formatDate(plan?.currentPeriodEnd ?? null);
  // Subskrypcja zaplanowana do anulowania (status wciąż „active", ale wygaśnie na
  // koniec okresu) — traktujemy jak anulowaną w opisie i znaczniku.
  const cancelScheduled = Boolean(plan?.cancelAtPeriodEnd);
  const statusLabel = cancelScheduled
    ? "anulowana"
    : plan && plan.status !== "active"
      ? STATUS_LABEL[plan.status] ?? plan.status
      : null;

  const openPortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Nie udało się otworzyć portalu.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Coś poszło nie tak. Spróbuj ponownie.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Plan i płatności
      </h2>
      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              Plan {TIER_LABEL[tier]}
              {statusLabel && (
                <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {statusLabel}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {tier === "free"
                ? "Darmowy dziennik z podstawowym AI (Freud, 5 rozmów dziennie)."
                : renewal
                  ? cancelScheduled || plan?.status === "canceled"
                    ? `Anulowana — dostęp do ${renewal}.`
                    : `Odnawia się ${renewal}.`
                  : "Pełne AI: wszystkie persony, pamięć i raporty."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm" variant={isPaid ? "outline" : "default"}>
            <Link href="/pricing">
              {isPaid ? "Zmień plan" : "Przejdź na Pro"}
            </Link>
          </Button>
          {plan?.hasStripeCustomer && (
            <Button
              size="sm"
              variant="outline"
              onClick={openPortal}
              disabled={portalLoading}
            >
              {portalLoading ? "Otwieram…" : "Zarządzaj subskrypcją"}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </section>
  );
}
