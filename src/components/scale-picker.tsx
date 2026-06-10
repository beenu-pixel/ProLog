"use client";

import { cn } from "@/lib/utils";
import type { Scale } from "@/lib/types";

const SCALES: Scale[] = [1, 2, 3, 4, 5];

interface ScalePickerProps {
  value?: Scale;
  onChange: (value: Scale) => void;
  /** Etykiety słowne poziomów 1..5. */
  levels: readonly string[];
  /** `lg` — pionowa lista pełnoekranowa (kreator); `sm` — kompaktowy rząd (edycja). */
  size?: "lg" | "sm";
  ariaLabel?: string;
  className?: string;
}

/**
 * Wybór wartości 1–5 osobnymi przyciskami (zamiast suwaka). Monochromatyczny,
 * w stylu Stoic. Wariant `lg` to lista „liczba + słowo" na pełny ekran kreatora,
 * `sm` to rząd okrągłych przycisków z liczbą (etykieta w tooltipie) do edycji.
 */
export function ScalePicker({
  value,
  onChange,
  levels,
  size = "lg",
  ariaLabel,
  className,
}: ScalePickerProps) {
  if (size === "sm") {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn("flex gap-1.5", className)}
      >
        {SCALES.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${n} — ${levels[n - 1]}`}
              title={levels[n - 1]}
              onClick={() => onChange(n)}
              className={cn(
                "flex size-9 items-center justify-center rounded-full border text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:border-foreground/50 hover:text-foreground"
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-2", className)}
    >
      {SCALES.map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(n)}
            className={cn(
              "flex items-center gap-4 rounded-xl border px-5 py-4 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-accent"
            )}
          >
            <span className="w-7 text-center text-2xl font-bold tabular-nums">
              {n}
            </span>
            <span className="text-base font-medium">{levels[n - 1]}</span>
          </button>
        );
      })}
    </div>
  );
}
