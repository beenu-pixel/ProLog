import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { PLAN_CARDS } from "@/lib/pricing-plans";
import { PricingCta } from "@/components/pricing-cta";

// Cennik ProLog — 3 plany (Free / Pro / Max). Dane planów współdzielone z sekcją cen
// na landingu (src/lib/pricing-plans.ts). CTA Pro/Max tworzą SERWEROWO sesję Stripe
// Checkout (userId z sesji JWT, nie z URL-a). Styl czarno-biały, stoicki.

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Plany ProLog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dziennik jest darmowy. Płacisz za głębsze AI — nie za pojedyncze persony.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLAN_CARDS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col rounded-2xl border p-6",
              plan.featured && "border-foreground shadow-sm"
            )}
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
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

            {plan.id === "free" ? (
              <Link
                href="/entries"
                className="inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Korzystaj za darmo
              </Link>
            ) : (
              <PricingCta
                plan={plan.id === "pro" ? "pro" : "max"}
                period="monthly"
                label={`Wybierz ${plan.name}`}
                featured={plan.featured}
              />
            )}
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        <Link href="/entries" className="underline-offset-4 hover:underline">
          ← Wróć do dziennika
        </Link>
      </p>
    </div>
  );
}
