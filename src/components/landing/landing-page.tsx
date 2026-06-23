import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingTherapists } from "@/components/landing/landing-therapists";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

/**
 * Publiczna strona marketingowa ProLog (trasa `/`). Landing jest ZAWSZE ciemny —
 * `.dark` na korzeniu przestawia tokeny motywu tylko w tym poddrzewie (Tailwind v4,
 * `@custom-variant dark`), niezależnie od motywu reszty aplikacji.
 */
export function LandingPage() {
  // Uwaga: AppShell renderuje już <main> wokół treści trasy — tu używamy <div>,
  // by nie zagnieżdżać dwóch elementów <main>.
  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-foreground">
      <LandingHeader />
      <div className="flex-1">
        <LandingHero />
        <LandingFeatures />
        <LandingTherapists />
        <LandingPricing />
        <LandingCta />
      </div>
      <LandingFooter />
    </div>
  );
}
