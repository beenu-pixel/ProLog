import { cn } from "@/lib/utils";

interface MetricTrendProps {
  /** Wartości dzień-po-dniu (1–5) lub null dla dni bez danych. */
  values: (number | null)[];
  className?: string;
}

/** Mini monochromatyczny wykres słupkowy trendu metryki w okresie. */
export function MetricTrend({ values, className }: MetricTrendProps) {
  return (
    <div className={cn("flex h-10 items-end gap-px", className)} aria-hidden>
      {values.map((value, i) => (
        <div key={i} className="flex h-full flex-1 items-end">
          {value !== null ? (
            <div
              className="w-full rounded-sm bg-foreground"
              style={{ height: `${(value / 5) * 100}%` }}
            />
          ) : (
            <div className="h-px w-full bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}
