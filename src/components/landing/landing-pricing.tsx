import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { PLAN_CARDS } from "@/lib/pricing-plans";
import { Reveal } from "@/components/landing/reveal";

/**
 * Sekcja cennika na landingu (kotwica `#plany`). Te same dane planów co strona
 * /pricing (src/lib/pricing-plans.ts). Landing widzą wyłącznie goście (zalogowanych
 * przenosi SessionRedirect), więc każde CTA prowadzi do rejestracji — po założeniu
 * konta użytkownik trafia na /pricing (onboarding) i tam może kupić plan.
 */
export function LandingPricing() {
  return (
    <section
      id="plany"
      className="mx-auto w-full max-w-6xl px-6 py-20 lg:px-8 lg:py-28"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Prosty cennik
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Dziennik jest darmowy na zawsze. Płacisz tylko za głębsze AI —
          nie za pojedyncze persony.
        </p>
      </Reveal>

      <Reveal className="mt-14 grid gap-6 md:grid-cols-3">
        {PLAN_CARDS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col rounded-3xl border p-6",
              plan.featured
                ? "border-foreground bg-card shadow-[0_0_40px_-12px_rgba(255,255,255,0.15)]"
                : "bg-card/60"
            )}
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {plan.price}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            </div>

            <ul className="mb-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/welcome"
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors",
                plan.featured
                  ? "bg-foreground text-background hover:opacity-90"
                  : "border hover:bg-secondary"
              )}
            >
              {plan.id === "free" ? "Zacznij za darmo" : `Wybierz ${plan.name}`}
            </Link>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
