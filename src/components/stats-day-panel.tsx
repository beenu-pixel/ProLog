import Link from "next/link";

import { MetricValue } from "@/components/metric-value";
import { METRICS, averageMetric } from "@/lib/metrics";
import { formatDate, formatTime } from "@/lib/format";
import type { Entry } from "@/lib/types";

interface StatsDayPanelProps {
  date: Date;
  entries: Entry[];
}

/** Panel wybranego dnia: uśrednione metryki + lista wpisów (wejście w wpis). */
export function StatsDayPanel({ date, entries }: StatsDayPanelProps) {
  const present = METRICS.filter(
    (metric) => averageMetric(entries, metric.key) !== null
  );

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <h2 className="font-semibold tracking-tight">
        {formatDate(date.toISOString())}
      </h2>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak wpisów tego dnia.</p>
      ) : (
        <>
          {present.length > 0 && (
            <div className="space-y-1">
              {present.map((metric) => (
                <MetricValue
                  key={metric.key}
                  metricKey={metric.key}
                  value={averageMetric(entries, metric.key)}
                />
              ))}
            </div>
          )}

          <ul className="space-y-1">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/entries/${entry.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
                >
                  <span className="truncate text-sm font-medium">
                    {entry.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTime(entry.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
