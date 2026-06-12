"use client";

import { useMemo, useState } from "react";

import { StatsCalendar } from "@/components/stats-calendar";
import { StatsSummary } from "@/components/stats-summary";
import { StatsDayPanel } from "@/components/stats-day-panel";
import { PageScroll } from "@/components/page-scroll";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { addDays, dayKey, formatMonthYear } from "@/lib/format";
import {
  buildGrid,
  daysInRange,
  entriesInRange,
  groupByDay,
  viewRange,
  type StatsView,
} from "@/lib/stats";

export default function StatsPage() {
  const entries = useEntries();
  const ready = useHydrated();

  const [view, setView] = useState<StatsView>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const dayMap = useMemo(() => groupByDay(entries), [entries]);
  const grid = useMemo(() => buildGrid(view, anchor), [view, anchor]);
  const { start, end } = useMemo(() => viewRange(view, anchor), [view, anchor]);
  const rangeEntries = useMemo(
    () => entriesInRange(entries, start, end),
    [entries, start, end]
  );
  const rangeDays = useMemo(() => daysInRange(start, end), [start, end]);

  const periodLabel =
    view === "month"
      ? formatMonthYear(
          new Date(anchor.getFullYear(), anchor.getMonth(), 1).toISOString()
        )
      : `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("pl-PL", {
          month: "short",
        })}`;

  const navigate = (dir: -1 | 1) => {
    setSelectedDate(null);
    setAnchor((prev) =>
      view === "week"
        ? addDays(prev, dir * 7)
        : new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
    );
  };

  const handleSetView = (next: StatsView) => {
    setSelectedDate(null);
    setView(next);
  };

  const selectedKey = selectedDate ? dayKey(selectedDate) : null;
  const selectedEntries = selectedKey ? (dayMap.get(selectedKey) ?? []) : [];

  if (!ready) return null;

  return (
    <PageScroll contentClassName="lg:pb-28">
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Statystyki</h1>

      <StatsCalendar
        view={view}
        periodLabel={periodLabel}
        grid={grid}
        anchorMonth={anchor.getMonth()}
        dayMap={dayMap}
        selectedKey={selectedKey}
        onSelect={(date) => setSelectedDate(date)}
        onSetView={handleSetView}
        onNavigate={navigate}
      />

      {selectedDate ? (
        <StatsDayPanel date={selectedDate} entries={selectedEntries} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Wybierz dzień z wpisem, aby zobaczyć szczegóły.
        </p>
      )}

      <StatsSummary
        rangeEntries={rangeEntries}
        days={rangeDays}
        dayMap={dayMap}
      />
      </div>
    </PageScroll>
  );
}
