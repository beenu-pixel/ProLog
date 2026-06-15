import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingTherapists } from "@/components/landing/landing-therapists";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

/** Publiczna strona marketingowa ProLog (trasa `/`). */
export function LandingPage() {
  // Uwaga: AppShell renderuje już <main> wokół treści trasy — tu używamy <div>,
  // by nie zagnieżdżać dwóch elementów <main>.
  return (
    <div className="flex min-h-dvh flex-col">
      <LandingHeader />
      <div className="flex-1">
        <LandingHero />
        <LandingFeatures />
        <LandingTherapists />
        <LandingCta />
      </div>
      <LandingFooter />
    </div>
  );
}
