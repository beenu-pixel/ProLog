"use client";

import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";

/**
 * Przycisk zakupu planu na /pricing. Do URL-a Payment Linka Stripe dokleja
 * `?client_reference_id=<userId>`, żeby webhook wiedział, KTÓRE konto odblokować
 * po płatności (Payment Link sam tego nie przenosi). Niezalogowany jest najpierw
 * kierowany do logowania (z powrotem na /pricing) — bez konta nie ma userId.
 */
export function PricingCta({
  paymentLink,
  label,
  featured,
}: {
  paymentLink: string;
  label: string;
  featured?: boolean;
}) {
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const href = userId
    ? `${paymentLink}?client_reference_id=${encodeURIComponent(userId)}`
    : "/welcome?next=/pricing";

  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors",
        featured
          ? "bg-foreground text-background hover:opacity-90"
          : "border hover:bg-secondary"
      )}
    >
      {userId ? label : "Zaloguj się, aby kupić"}
    </a>
  );
}
