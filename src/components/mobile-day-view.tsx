"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { DayStrip } from "@/components/day-strip";
import { MetricValue } from "@/components/metric-value";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { setOpenDay } from "@/lib/active-context";
import { METRICS } from "@/lib/metrics";
import { groupByDay } from "@/lib/stats";
import { addDays, dayKey, formatDate, formatTime } from "@/lib/format";
import type { Entry } from "@/lib/types";

const DAYS_BACK = 30;

/**
 * Mobilny widok Dziennika w stylu Imperfect: u góry poziomy pasek dni, po środku
 * treść wpisu (lub wpisów) z zaznaczonego dnia. Domyślnie zaznaczony jest dziś.
 * Gdy dla wybranego dnia nie ma wpisu — wyśrodkowany przycisk z mikrofonem
 * prowadzący do kreatora wpisu.
 */
export function MobileDayView() {
  const entries = useEntries();
  const ready = useHydrated();

  // Stabilna „kotwica dziś" liczona raz — pasek i zaznaczenie nie skaczą między
  // renderami.
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState<Date>(today);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_BACK }, (_, i) =>
        addDays(today, i - (DAYS_BACK - 1))
      ),
    [today]
  );

  const entriesByDay = useMemo(() => groupByDay(entries), [entries]);

  const selectedKey = dayKey(selected);
  const dayEntries = entriesByDay.get(selectedKey) ?? [];

  // Udostępnia zaznaczony dzień globalnie, by terapeuta wiedział, na co patrzymy.
  useEffect(() => {
    setOpenDay(selectedKey);
  }, [selectedKey]);

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="sticky top-14 z-30 -mt-6 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <DayStrip
          days={days}
          selectedKey={selectedKey}
          entriesByDay={entriesByDay}
          onSelect={setSelected}
        />
      </div>

      <div className="flex flex-1 flex-col pt-4">
        {!ready ? null : dayEntries.length > 0 ? (
          <div className="space-y-8">
            {dayEntries.map((entry) => (
              <DayEntry key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <EmptyDay />
        )}
      </div>
    </div>
  );
}

/** Pojedynczy wpis dnia: godzina, tytuł, metryki i treść. Tap → szczegół. */
function DayEntry({ entry }: { entry: Entry }) {
  const hasMetrics = METRICS.some(
    (metric) => typeof entry[metric.key] === "number"
  );

  return (
    <Link href={`/entries/${entry.id}`} className="block space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{entry.title}</h1>
      </div>

      {hasMetrics && (
        <div className="space-y-1 rounded-xl border p-4">
          {METRICS.map((metric) =>
            typeof entry[metric.key] === "number" ? (
              <MetricValue
                key={metric.key}
                metricKey={metric.key}
                value={entry[metric.key]}
              />
            ) : null
          )}
        </div>
      )}

      {entry.content ? (
        <div
          className="prose-content text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: entry.content }}
        />
      ) : (
        <p className="text-sm italic text-muted-foreground">Brak treści.</p>
      )}
    </Link>
  );
}

/** Pusty dzień: zwięzła informacja. Rozmowa/dodawanie jest w dolnym pasku. */
function EmptyDay() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <p className="max-w-[16rem] text-sm text-muted-foreground">
        Brak wpisu na ten dzień.
      </p>
    </div>
  );
}
