import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";

export function LandingCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-24 lg:px-8 lg:pb-32">
      <Reveal className="overflow-hidden rounded-3xl border bg-foreground px-6 py-16 text-center text-background lg:py-20">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Zacznij rozmowę ze swoim spokojem
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-background/70">
          Załóż darmowe konto i napisz pierwszy wpis. Reszta — refleksja, nastrój
          i rozmowa z AI — przyjdzie naturalnie.
        </p>
        <Button
          asChild
          size="lg"
          variant="secondary"
          className="mt-8 transition-transform duration-300 hover:scale-[1.03]"
        >
          <Link href="/welcome">Rozpocznij za darmo</Link>
        </Button>
      </Reveal>
    </section>
  );
}
