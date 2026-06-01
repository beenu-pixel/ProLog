"use client";

import { cn } from "@/lib/utils";
import type { Mood } from "@/lib/types";

const MOODS: Mood[] = [1, 2, 3, 4, 5];

const MOOD_LABELS: Record<Mood, string> = {
  1: "Bardzo źle",
  2: "Słabo",
  3: "Neutralnie",
  4: "Dobrze",
  5: "Bardzo dobrze",
};

interface MoodDotsProps {
  value: Mood;
  /** Tryb interaktywny — gdy podany, kropki są klikalne. */
  onChange?: (mood: Mood) => void;
  className?: string;
  size?: "sm" | "md";
}

/** Skala nastroju 1–5 jako monochromatyczne kropki (styl Stoic). */
export function MoodDots({
  value,
  onChange,
  className,
  size = "md",
}: MoodDotsProps) {
  const interactive = typeof onChange === "function";
  const dotSize = size === "sm" ? "size-2.5" : "size-3.5";

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role={interactive ? "radiogroup" : undefined}
      aria-label="Nastrój"
    >
      {MOODS.map((mood) => {
        const filled = mood <= value;
        const dot = (
          <span
            className={cn(
              dotSize,
              "block rounded-full border border-foreground transition-colors",
              filled ? "bg-foreground" : "bg-transparent"
            )}
          />
        );

        if (!interactive) {
          return <span key={mood}>{dot}</span>;
        }

        return (
          <button
            key={mood}
            type="button"
            role="radio"
            aria-checked={value === mood}
            aria-label={MOOD_LABELS[mood]}
            title={MOOD_LABELS[mood]}
            onClick={() => onChange?.(mood)}
            className="rounded-full p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:scale-110 transition-transform"
          >
            {dot}
          </button>
        );
      })}
    </div>
  );
}

export { MOOD_LABELS };
