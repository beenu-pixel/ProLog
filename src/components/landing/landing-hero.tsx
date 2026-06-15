"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAnimationsEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Scena WebGL ładowana leniwie i tylko po stronie klienta — nie wchodzi do
// bundla pierwszego renderu, a tekst/CTA są widoczne natychmiast.
const HeroScene = dynamic(() => import("@/components/landing/hero-scene"), {
  ssr: false,
});

const BUST_SRC = "/marcus-aurelius.jpg"; // poster / fallback
const POINTS_SRC = "/marcus-points.bin"; // chmura punktów-skorupy (three.js)

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function LandingHero() {
  const [animationsEnabled] = useAnimationsEnabled();
  const reduced = useReducedMotion();
  const [webgl, setWebgl] = useState(false);
  const [inView, setInView] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => setWebgl(hasWebGL()), []);

  // Montujemy scenę dopiero, gdy hero jest w polu widzenia.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const animate = animationsEnabled && !reduced && webgl;
  const showScene = animate && inView;

  return (
    <section
      id="gora"
      className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-6 pt-16 pb-20 lg:grid lg:grid-cols-2 lg:items-center lg:gap-8 lg:px-8 lg:pt-24 lg:pb-28"
    >
      {/* Treść — natychmiast widoczna, dobra dla SEO */}
      <div className="order-2 max-w-xl text-center lg:order-1 lg:text-left">
        <p className="landing-fade-up text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Dziennik w duchu stoicyzmu
        </p>
        <h1 className="landing-fade-up landing-delay-1 mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Twój stoicki przewodnik.
          <br />
          <span className="text-muted-foreground">Cyfrowy psychoterapeuta.</span>
        </h1>
        <p className="landing-fade-up landing-delay-2 mx-auto mt-6 max-w-md text-base text-muted-foreground lg:mx-0 lg:text-lg">
          ProLog czyta Twoje wpisy i rozmawia z Tobą jak mędrzec — pomaga
          zrozumieć emocje, nazwać myśli i wracać do tego, co zależy od Ciebie.
        </p>
        <div className="landing-fade-up landing-delay-3 mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/welcome">Rozpocznij za darmo</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="#funkcje">Zobacz, jak działa</Link>
          </Button>
        </div>
        <p className="landing-fade-up landing-delay-3 mt-6 text-sm text-muted-foreground italic">
          „Masz władzę nad swoim umysłem — nie nad światem zewnętrznym."
          <span className="not-italic"> — Marek Aureliusz</span>
        </p>
      </div>

      {/* Scena 3D / poster popiersia */}
      <div className="order-1 w-full lg:order-2">
        <div
          ref={stageRef}
          className="relative mx-auto aspect-[3/4] w-full max-w-sm sm:max-w-md lg:max-w-none"
        >
          {/* Poster — baza/fallback. Znika, gdy scena cząsteczkowa jest gotowa. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BUST_SRC}
            alt="Popiersie Marka Aureliusza"
            className={cn(
              "absolute inset-0 h-full w-full object-contain transition-opacity duration-700",
              "[mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_100%)]",
              showScene && sceneReady ? "opacity-0" : "opacity-100"
            )}
          />
          {showScene && (
            <HeroScene
              src={POINTS_SRC}
              onReady={() => setSceneReady(true)}
              className={cn(
                "absolute inset-0 h-full w-full transition-opacity duration-700",
                sceneReady ? "opacity-100" : "opacity-0"
              )}
            />
          )}
        </div>
      </div>
    </section>
  );
}
