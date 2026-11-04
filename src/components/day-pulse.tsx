import { ArrowDown } from "lucide-react";

import { Meter } from "@/components/meter";
import { METRICS, needsAttention } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { Entry } from "@/lib/types";

/**
 * „Puls dnia”: pięć ocen wpisu w jednym zwartym bloku zamiast ramki z pięcioma
 * wierszami kropek. Każda ocena to krótka nazwa, miernik i słowo poziomu. Dane
 * mówią kierunkiem: przy stresie strzałka w dół (mniej znaczy lepiej), a ocena,
 * która wymaga uwagi (np. słaby sen, silny stres), dostaje kolor uwagi — obok
 * zawsze zostaje słowo, więc kolor nie niesie znaczenia sam.
 *
 * Układ zależy od miejsca, nie od ekranu (zapytanie o kontener): w wąskiej
 * kolumnie dwie kolumny ocen, od 32rem pięć w jednym rzędzie.
 */
export function DayPulse({ entry, className }: { entry: Entry; className?: string }) {
  const rated = METRICS.filter((metric) => typeof entry[metric.key] === "number");
  if (rated.length === 0) return null;

  return (
    <div className={cn("@container", className)}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 @lg:grid-cols-5 @lg:gap-x-0 @lg:py-0">
        {rated.map((metric) => {
          const value = entry[metric.key] as NonNullable<Entry["mood"]>;
          const attention = needsAttention(metric.key, value);
          return (
            <div
              key={metric.key}
              className="flex min-w-0 flex-col gap-2 @lg:py-4 @lg:pr-3 @lg:[&+&]:border-l @lg:[&+&]:pl-4"
            >
              <dt className="flex items-center gap-1 text-caption text-subtle-foreground">
                {metric.short}
                {metric.inverted && (
                  <>
                    <ArrowDown className="size-3" strokeWidth={2} aria-hidden />
                    <span className="sr-only">(mniej znaczy lepiej)</span>
                  </>
                )}
              </dt>
              <dd className="flex min-w-0 items-center gap-2 @lg:flex-col @lg:items-start">
                <Meter value={value} attention={attention} />
                <span
                  className={cn(
                    "text-ui",
                    attention ? "text-attention" : "text-foreground"
                  )}
                >
                  {metric.levels[value - 1]}
                  <span className="sr-only">, {value} z 5</span>
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
