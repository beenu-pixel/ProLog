import { cn } from "@/lib/utils";

const STEPS = [1, 2, 3, 4, 5] as const;

/**
 * Miernik skali 1–5: pięć segmentów wypełnionych do wartości. Sama grafika —
 * wartość zawsze ogłasza tekst obok (słowo poziomu albo etykieta dla czytnika),
 * więc miernik jest `aria-hidden`. `attention` barwi wypełnienie kolorem „uwagi”;
 * kolor tylko wzmacnia to, co mówi słowo.
 *
 * `md` — poziome segmenty w pulsie dnia; `xs` — pionowe kreski na liście wpisów.
 */
export function Meter({
  value,
  attention = false,
  size = "md",
  className,
}: {
  value: number;
  attention?: boolean;
  size?: "md" | "xs";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0",
        size === "xs" ? "items-end gap-0.5" : "gap-1",
        className
      )}
    >
      {STEPS.map((step) => (
        <span
          key={step}
          className={cn(
            "block rounded-xs",
            size === "xs" ? "h-3 w-1" : "h-1.5 w-2",
            step <= value
              ? attention
                ? "bg-attention"
                : "bg-foreground"
              : "bg-meter-off"
          )}
        />
      ))}
    </span>
  );
}
