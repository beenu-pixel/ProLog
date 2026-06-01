"use client";

import { cn } from "@/lib/utils";
import { MOOD_LABELS } from "@/components/mood-dots";
import type { Mood } from "@/lib/types";

// Kółko mniejsze od toru, z odstępem od krawędzi — proporcje jak w przełączniku
// motywu (kółko size-5 = 20px w torze h-7 = 28px, odstęp 4px z każdej strony).
const KNOB = 20;
const KNOB_R = KNOB / 2;
const PAD = 4; // odstęp kółka od krawędzi toru

interface MoodSliderProps {
  value: Mood;
  onChange: (mood: Mood) => void;
  className?: string;
}

export function MoodSlider({ value, onChange, className }: MoodSliderProps) {
  const pct = (value - 1) / 4; // 0..1
  // Środek kółka — z odstępem PAD od obu krawędzi toru.
  const knobLeft = `calc(${PAD + KNOB_R}px + ${pct} * (100% - ${2 * PAD + KNOB}px))`;
  // Wypełnienie sięga do PRAWEJ krawędzi kółka, więc kółko całe leży na tle.
  const fillWidth = `calc(${PAD + KNOB}px + ${pct} * (100% - ${2 * PAD + KNOB}px))`;

  return (
    <div
      className={cn(
        "relative h-7 w-full max-w-xs select-none rounded-full border bg-secondary has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
        className
      )}
    >
      {/* Wypełnienie (lewa część toru). */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-foreground transition-[width] duration-150"
        style={{ width: fillWidth }}
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
        aria-label={`Nastrój — ${MOOD_LABELS[value]}`}
        aria-valuetext={MOOD_LABELS[value]}
        onChange={(e) => onChange(Number(e.target.value) as Mood)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
