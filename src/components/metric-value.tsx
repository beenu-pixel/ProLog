import { MoodDots } from "@/components/mood-dots";
import { METRIC_BY_KEY } from "@/lib/metrics";
import type { MetricKey, Scale } from "@/lib/types";

interface MetricValueProps {
  metricKey: MetricKey;
  /** Wartość metryki — całkowita (pojedynczy wpis) lub ułamkowa (średnia). */
  value?: number | null;
}

/**
 * Read-only wiersz metryki: nazwa + monochromatyczne kropki + opis. Dla wartości
 * całkowitej pokazuje słowo poziomu (np. „Dobrze"); dla średniej — liczbę (3,4).
 * Brak danych → „—".
 */
export function MetricValue({ metricKey, value }: MetricValueProps) {
  const def = METRIC_BY_KEY[metricKey];
  const num = typeof value === "number" ? value : null;
  const rounded =
    num !== null ? (Math.min(5, Math.max(1, Math.round(num))) as Scale) : null;
  const text =
    num === null
      ? "—"
      : Number.isInteger(num)
        ? def.levels[num - 1]
        : num.toFixed(1).replace(".", ",");

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-muted-foreground">{def.label}</span>
      <div className="flex items-center gap-2">
        {rounded && <MoodDots value={rounded} size="sm" label={def.label} />}
        <span className="min-w-[5.5rem] text-right text-xs text-muted-foreground">
          {text}
        </span>
      </div>
    </div>
  );
}
