"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/auth";
import type { BillingPeriod, PaidTier } from "@/lib/stripe-prices";

/**
 * Przycisk zakupu planu na /pricing. Tworzy SERWEROWO sesję Stripe Checkout
 * (`POST /api/billing/checkout`) i przekierowuje na zwrócony URL. userId bierze się
 * z sesji JWT po stronie serwera — przeglądarka NIE przekazuje już identyfikatora
 * konta (eliminacja podmiany cudzego userId, która groziła przy Payment Linkach).
 * Niezalogowany jest najpierw kierowany do logowania (z powrotem na /pricing).
 */
export function PricingCta({
  plan,
  period = "monthly",
  label,
  featured,
}: {
  plan: PaidTier;
  period?: BillingPeriod;
  label: string;
  featured?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        window.location.assign("/welcome?next=/pricing");
        return;
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, period }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Nie udało się rozpocząć płatności.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Coś poszło nie tak. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className={cn(
          "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60",
          featured
            ? "bg-foreground text-background hover:opacity-90"
            : "border hover:bg-secondary"
        )}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {label}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
