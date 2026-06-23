"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { THERAPISTS } from "@/lib/therapists";
import { Reveal } from "@/components/landing/reveal";

/**
 * Sekcja landingu prezentująca persony terapeutów jako poziomą karuzelę
 * portretów (scroll-snap + strzałki ‹ ›). Portrety są ZAWSZE w skali szarości
 * (spójny, stoicki wygląd; różne źródła: zdjęcia i popiersia). Na hover kafelek
 * się nie skaluje — unosi się tylko podpis (nakładka nad gradientem) i pojawia
 * delikatna poświata. Czysto prezentacyjna — wybór persony dzieje się w aplikacji.
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
              className="group relative aspect-[4/5] w-64 shrink-0 snap-start overflow-hidden rounded-3xl border bg-secondary transition-shadow duration-300 hover:shadow-[0_0_40px_-8px_rgba(255,255,255,0.14)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.image}
                alt={t.name}
                loading="lazy"
                className="absolute inset-0 size-full object-cover grayscale"
              />
              {/* Scrim u dołu — czytelność podpisu na zdjęciu. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />
              {/* Podpis jako nakładka — na hover unosi się i odrobinę bardziej zasłania zdjęcie. */}
              <figcaption className="absolute inset-x-0 bottom-0 space-y-1.5 p-5 text-white transition-transform duration-300 group-hover:-translate-y-2">
                <p className="text-lg font-semibold tracking-tight">{t.name}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                  {t.title}
                </p>
                <p className="pt-1 text-sm leading-relaxed text-white/80">
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
