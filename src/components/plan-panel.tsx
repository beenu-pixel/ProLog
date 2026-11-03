"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingDots, LoadingText } from "@/components/ui/loading-dots";
import { getAccessToken } from "@/lib/auth";
import { usePageRestored } from "@/hooks/use-page-restored";
import {
  reloadPlan,
  setPlanActivating,
  usePlan,
  usePlanActivating,
  usePlanFailed,
} from "@/hooks/use-plan";

// Webhook Stripe zwykle dociera w kilka sekund; dłużej mówimy wprost, że to potrwa.
const ACTIVATION_POLL_MS = 2_000;
const ACTIVATION_LIMIT_MS = 30_000;

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

/** Plan z adresu powrotu z płatności: `null` = nie wracamy z płatności, `"any"` = plan nieznany. */
function readUpgradeReturn(): "pro" | "max" | "any" | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("upgraded");
  if (!value) return null;
  return value === "pro" || value === "max" ? value : "any";
}

/**
 * Potwierdzenie po powrocie z płatności, na górze Ustawień, bo panel planu jest
 * niżej, poza ekranem. Plan ustawia webhook, więc dopytujemy, aż się zmieni.
 */
export function UpgradeNotice() {
  const plan = usePlan();
  const [wanted] = useState(readUpgradeReturn);
  const [timedOut, setTimedOut] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const active =
    plan !== null &&
    (wanted === "any" ? plan.tier !== "free" : plan.tier === wanted);
  const waiting = wanted !== null && !active && !timedOut;

  // Odświeżenie strony nie powinno ogłaszać płatności drugi raz.
  useEffect(() => {
    if (wanted) window.history.replaceState(null, "", window.location.pathname);
  }, [wanted]);

  useEffect(() => {
    setPlanActivating(waiting);
    if (!waiting) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt >= ACTIVATION_LIMIT_MS) setTimedOut(true);
      else void reloadPlan();
    }, ACTIVATION_POLL_MS);
    return () => {
      clearInterval(timer);
      setPlanActivating(false);
    };
  }, [waiting]);

  if (!wanted || dismissed) return null;

  if (waiting) {
    return (
      <div className="rounded-xl border p-4">
        <LoadingText className="justify-start text-foreground">
          Płatność przyjęta. Aktywuję plan
        </LoadingText>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border p-4"
    >
      <p className="text-sm">
        {active
          ? `Gotowe, masz plan ${TIER_LABEL[plan.tier]}.`
          : "Płatność przyjęta, ale aktywacja trwa dłużej niż zwykle. Zajrzyj tu za kilka minut."}
      </p>
      <button
        type="button"
        aria-label="Zamknij"
        onClick={() => setDismissed(true)}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * Panel „Plan i płatności" w Ustawieniach: bieżący plan, status i data odnowienia,
 * przejście do cennika oraz (dla płacących) portal Stripe do zarządzania subskrypcją.
 * Czyta stan z `usePlan` (/api/plan). Plan ustawia wyłącznie webhook — to tylko widok.
 */
export function PlanPanel() {
  const plan = usePlan();
  const failed = usePlanFailed();
  const activating = usePlanActivating();
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
      if (!token) {
        setPortalLoading(false);
        return;
      }
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Nie udało się otworzyć portalu.");
        setPortalLoading(false);
        return;
      }
      // Ładowanie zostaje do przejścia na portal płatności.
      window.location.assign(data.url);
    } catch {
      setError("Coś poszło nie tak. Spróbuj ponownie.");
      setPortalLoading(false);
    }
  };

  // Cofnięcie z portalu przywraca przycisk razem ze stanem ładowania.
  usePageRestored(useCallback(() => setPortalLoading(false), []));

  // Bez znanego planu nie mówimy „Plan Free": konto Pro zobaczyłoby nieprawdę.
  if (activating || !plan) {
    return (
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plan i płatności
        </h2>
        <div className="space-y-3 rounded-xl border p-4">
          {activating ? (
            <LoadingText className="justify-start">Aktywuję plan</LoadingText>
          ) : failed ? (
            <>
              <p className="text-sm text-muted-foreground">
                Nie udało się wczytać planu.
              </p>
              <Button size="sm" variant="outline" onClick={() => void reloadPlan()}>
                Spróbuj ponownie
              </Button>
            </>
          ) : (
            <LoadingText className="justify-start">Wczytuję plan</LoadingText>
          )}
        </div>
      </section>
    );
  }

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
                <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground-onmuted">
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
              aria-busy={portalLoading}
            >
              {portalLoading ? "Otwieram" : "Zarządzaj subskrypcją"}
              {portalLoading && <LoadingDots />}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </section>
  );
}
