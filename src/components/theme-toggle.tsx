"use client";

import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sound";
import { useHydrated } from "@/hooks/use-hydrated";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const isDark = hydrated && resolvedTheme === "dark";

  // Stan ikony (księżyc↔słońce) przestawiamy o klatkę WCZEŚNIEJ niż motyw — bo
  // wewnątrz callbacku View Transitions renderowanie jest wstrzymane i przejścia
  // CSS by nie wystartowały. Położenie kulki idzie osobno, z `isDark`: to VT
  // przesuwa kciuk (patrz komentarz przy elemencie), więc w chwili zrzutu musi
  // on stać jeszcze po starej stronie.
  const [icon, setIcon] = useState(isDark);
  // Motyw zmieniony spoza tego przycisku (hydratacja, systemowy dark mode)
  // dociągamy w trakcie renderu — bez efektu i bez dodatkowej klatki.
  const [seenDark, setSeenDark] = useState(isDark);
  if (seenDark !== isDark) {
    setSeenDark(isDark);
    setIcon(isDark);
  }

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    playSound("theme-toggle");
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };

    if (typeof doc.startViewTransition !== "function") {
      setIcon(next === "dark");
      setTheme(next);
      return;
    }

    // Kierunek turlania czyta CSS z klasy na <html> (w prawo = w stronę nocy).
    const root = document.documentElement;
    root.classList.add(next === "dark" ? "theme-roll-right" : "theme-roll-left");
    // Ikona zmienia się przed startem VT, żeby jej morf zdążył ruszyć.
    flushSync(() => setIcon(next === "dark"));

    // Płynny crossfade całej strony przy zmianie motywu — View Transitions API
    // animuje zrzut strony, a nie pojedyncze elementy, więc tekst/ikony nie
    // migoczą. flushSync wymusza synchroniczne nałożenie nowego motywu, żeby
    // przeglądarka zdążyła uchwycić „nowy" stan przed startem animacji.
    const vt = doc.startViewTransition(() =>
      flushSync(() => setTheme(next))
    ) as unknown as { finished?: Promise<void> };
    const clear = () => {
      root.classList.remove("theme-roll-right", "theme-roll-left");
    };
    vt.finished?.then(clear, clear);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Przełącz tryb jasny/ciemny"
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border bg-secondary transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      )}
    >
      {/* Kciuk jest osobną grupą View Transitions. WAŻNE: element z
          `view-transition-name` oddaje swój `transform` grupie VT, więc własne
          `translate/rotate` na nim byłyby w czasie przejścia niewidoczne.
          Dlatego przejazd robi grupa VT, a obrót (turlanie) dokłada keyframe na
          pseudo-elemencie `::view-transition-new(theme-thumb)` — patrz
          globals.css. W spoczynku kulka nie jest obrócona, więc księżyc zawsze
          stoi prosto. Przejście CSS zostaje dla przeglądarek bez VT. */}
      <span
        style={{ viewTransitionName: "theme-thumb" }}
        className={cn(
          "theme-thumb absolute flex size-5 items-center justify-center rounded-full bg-background text-foreground shadow-md",
          "transition-transform duration-[350ms] ease-[ease]",
          isDark ? "translate-x-6" : "translate-x-1"
        )}
      >
        <SunMoon isDark={icon} />
      </span>
    </button>
  );
}

/**
 * Ikona księżyc↔słońce jako JEDEN kształt, który się przepoczwarza (zamiast
 * crossfade'u dwóch ikon):
 * - tarcza rośnie/maleje (słońce jest mniejsze, bo dochodzą promienie),
 * - wycięcie (maska) odjeżdża w bok — półksiężyc „wypełnia się" w pełną tarczę,
 * - promienie rozsuwają się od środka i pojawiają dopiero w trybie jasnym.
 */
function SunMoon({ isDark }: { isDark: boolean }) {
  const maskId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3 overflow-visible"
      aria-hidden
      focusable="false"
    >
      <mask id={maskId}>
        <rect x="0" y="0" width="24" height="24" fill="white" />
        {/* Wycięcie robiące półksiężyc; w trybie jasnym odjeżdża poza tarczę. */}
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="black"
          className="theme-thumb-shape transition-transform duration-[350ms] ease-[ease]"
          style={{ transform: isDark ? "translate(7px, -6px)" : "translate(20px, -16px)" }}
        />
      </mask>

      {/* Tarcza: księżyc jest większy, słońce mniejsze (robi miejsce promieniom). */}
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="currentColor"
        mask={`url(#${maskId})`}
        className="theme-thumb-shape origin-center transition-transform duration-[350ms] ease-[ease]"
        style={{ transform: `scale(${isDark ? 1 : 0.62})` }}
      />

      {/* Promienie — rozsuwają się od środka przy przejściu w tryb jasny. */}
      <g
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="theme-thumb-shape origin-center transition-all duration-[350ms] ease-[ease]"
        style={{
          opacity: isDark ? 0 : 1,
          transform: `scale(${isDark ? 0.35 : 1}) rotate(${isDark ? -45 : 0}deg)`,
        }}
      >
        <line x1="12" y1="1.5" x2="12" y2="3.5" />
        <line x1="12" y1="20.5" x2="12" y2="22.5" />
        <line x1="1.5" y1="12" x2="3.5" y2="12" />
        <line x1="20.5" y1="12" x2="22.5" y2="12" />
        <line x1="4.6" y1="4.6" x2="6" y2="6" />
        <line x1="18" y1="18" x2="19.4" y2="19.4" />
        <line x1="4.6" y1="19.4" x2="6" y2="18" />
        <line x1="18" y1="6" x2="19.4" y2="4.6" />
      </g>
    </svg>
  );
}
