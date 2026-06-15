"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { THERAPISTS } from "@/lib/therapists";
import { Reveal } from "@/components/landing/reveal";

/**
 * Sekcja landingu prezentująca persony terapeutów jako poziomą karuzelę
 * portretów (scroll-snap + strzałki ‹ ›). Portrety są ujednolicone skalą
 * szarości (różne źródła: zdjęcia i popiersia), a po najechaniu wracają do
 * naturalnych barw. Czysto prezentacyjna — wybór persony dzieje się w aplikacji.
 */
export function LandingTherapists() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCards = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // Przewiń o ~80% szerokości widoku (kilka kart naraz, ale z zakładką).
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section
      id="terapeuci"
      className="mx-auto w-full max-w-6xl px-6 py-20 lg:px-8 lg:py-28"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Pięć umysłów, jeden dziennik
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Wybierz przewodnika, który mówi Twoim językiem — od chłodnej analizy po
          stoicki spokój. Każdy zna kontekst Twoich wpisów i prowadzi rozmowę na
          swój sposób.
        </p>
      </Reveal>

      <Reveal className="relative mt-14">
        {/* Strzałki — na desktopie; na mobile wystarcza przesuwanie palcem. */}
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
          aria-label="Poprzedni"
          className="absolute -left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow-md backdrop-blur transition-transform hover:scale-105 active:scale-95 lg:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCards(1)}
          aria-label="Następny"
          className="absolute -right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow-md backdrop-blur transition-transform hover:scale-105 active:scale-95 lg:flex"
        >
          <ChevronRight className="size-5" />
        </button>

        <div
          ref={trackRef}
          className="hide-native-scroll flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
        >
          {THERAPISTS.map((t) => (
            <figure
              key={t.id}
              className="group w-64 shrink-0 snap-start overflow-hidden rounded-3xl border bg-card transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="aspect-[4/5] overflow-hidden bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.image}
                  alt={t.name}
                  loading="lazy"
                  className={cn(
                    "size-full object-cover grayscale transition-all duration-500",
                    "group-hover:scale-[1.04] group-hover:grayscale-0"
                  )}
                />
              </div>
              <figcaption className="space-y-1.5 p-5">
                <p className="text-lg font-semibold tracking-tight">{t.name}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.title}
                </p>
                <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
                  {t.tagline}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
