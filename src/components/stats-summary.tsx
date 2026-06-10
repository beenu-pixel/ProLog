import { MetricValue } from "@/components/metric-value";
import { MetricTrend } from "@/components/metric-trend";
import { METRICS, averageMetric } from "@/lib/metrics";
import { dayKey } from "@/lib/format";
import type { Entry } from "@/lib/types";

interface StatsSummaryProps {
  /** Wpisy z widocznego okresu (do średnich). */
  rangeEntries: Entry[];
  /** Kolejne dni okresu (do mini-wykresów trendu). */
  days: Date[];
  dayMap: Map<string, Entry[]>;
}

/** Podsumowanie okresu: liczba wpisów + dla każdej metryki średnia i mini-trend. */
export function StatsSummary({ rangeEntries, days, dayMap }: StatsSummaryProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {rangeEntries.length}{" "}
        {rangeEntries.length === 1 ? "wpis" : "wpisy/ów"} w tym okresie
      </p>

      <div className="space-y-4">
        {METRICS.map((metric) => {
          const avg = averageMetric(rangeEntries, metric.key);
          const series = days.map((day) =>
            averageMetric(dayMap.get(dayKey(day)) ?? [], metric.key)
          );
          return (
            <div key={metric.key} className="space-y-1">
              <MetricValue metricKey={metric.key} value={avg} />
              <MetricTrend values={series} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
