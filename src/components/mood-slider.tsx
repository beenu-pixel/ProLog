"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { MOOD_LABELS } from "@/lib/metrics";
import type { Mood } from "@/lib/types";

// Domyślne etykiety poziomów (samopoczucie) — używane, gdy nie podano własnych.
const DEFAULT_LEVELS = [
  MOOD_LABELS[1],
  MOOD_LABELS[2],
  MOOD_LABELS[3],
  MOOD_LABELS[4],
  MOOD_LABELS[5],
];

// Kółko mniejsze od toru, z odstępem od krawędzi — proporcje jak w przełączniku
// motywu (kółko size-5 = 20px w torze h-7 = 28px, odstęp 4px z każdej strony).
const KNOB = 20;
const KNOB_R = KNOB / 2;
const PAD = 4; // odstęp kółka od krawędzi toru
// Wypełnienie celowo o 2px niższe i jego prawy koniec o 1px krótszy niż kółko,
// żeby zaokrąglony rożek wypełnienia chował się CAŁKOWICIE pod kółkiem (z 1px
// zapasem). Bez tego — przy skalowaniu ekranu (125/150%) szerokość wypełnienia
// i pozycja kółka zaokrąglają się do różnych pikseli i rożek „wychodzi" spod kółka.
const FILL_H = KNOB - 2; // 18px

interface MoodSliderProps {
  value: Mood;
  onChange: (mood: Mood) => void;
  /** Etykiety słowne poziomów 1..5 (domyślnie samopoczucie). */
  levels?: readonly string[];
  /** Nazwa metryki do etykiety a11y (domyślnie „Nastrój"). */
  label?: string;
  className?: string;
}

// Pozycja środka punktu/kółka na torze dla danej wartości pct (0..1) — wspólny
// wzór, dzięki czemu kropki-kroki leżą dokładnie na ścieżce kółka.
function trackLeft(p: number): string {
  return `calc(${PAD + KNOB_R}px + ${p} * (100% - ${2 * PAD + KNOB}px))`;
}

// Pięć kroków skali nastroju (1..5) jako pozycje 0..1.
const STEPS = [0, 0.25, 0.5, 0.75, 1];

export function MoodSlider({
  value,
  onChange,
  levels = DEFAULT_LEVELS,
  label = "Nastrój",
  className,
}: MoodSliderProps) {
  // Czy użytkownik aktualnie przeciąga suwak — steruje widocznością kroków.
  const [dragging, setDragging] = useState(false);
  const levelLabel = levels[value - 1];

  const pct = (value - 1) / 4; // 0..1
  // Środek kółka — z odstępem PAD od obu krawędzi toru.
  const knobLeft = trackLeft(pct);
  // Wypełnienie ma wysokość kółka i ten sam promień, zaczyna się PAD od lewej i
  // kończy na prawej krawędzi kółka — dzięki temu kółko idealnie pokrywa się
  // z zaokrągleniem wypełnienia (jak w przełączniku motywu).
  // Prawy koniec wypełnienia o 1px przed prawą krawędzią kółka (KNOB - 1), by
  // zaokrąglenie nie wystawało spod kółka.
  const fillWidth = `calc(${KNOB - 1}px + ${pct} * (100% - ${2 * PAD + KNOB}px))`;

  return (
    <div
      className={cn(
        "relative h-7 w-full max-w-xs select-none rounded-full border bg-secondary has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
        className
      )}
    >
      {/* Kroki skali — pojawiają się tylko podczas przeciągania (fade + lekkie
          powiększenie), znikają po puszczeniu suwaka. Leżą pod wypełnieniem,
          więc te „zaliczone" są nim zakryte. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-200",
          dragging ? "opacity-100" : "opacity-0"
        )}
      >
        {STEPS.map((p) => (
          <span
            key={p}
            className={cn(
              "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40 transition-transform duration-200",
              dragging ? "scale-100" : "scale-50"
            )}
            style={{ left: trackLeft(p) }}
          />
        ))}
      </div>
      {/* Wypełnienie — wysokość i promień jak kółko, wcięte PAD od krawędzi toru. */}
      <div
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-foreground transition-[width] duration-150"
        style={{ left: `${PAD}px`, width: fillWidth, height: `${FILL_H}px` }}
      />
      {/* Kółko. */}
      <div
        className="pointer-events-none absolute top-1/2 size-5 rounded-full bg-background shadow-md transition-[left] duration-150"
        style={{ left: knobLeft, transform: "translate(-50%, -50%)" }}
      />
      {/* Natywny suwak — przezroczysty, obsługuje drag, klawiaturę i ARIA. */}
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        aria-label={`${label} — ${levelLabel}`}
        aria-valuetext={levelLabel}
        onChange={(e) => onChange(Number(e.target.value) as Mood)}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onBlur={() => setDragging(false)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
