"use client";

import { useEffect, useMemo, useState } from "react";

import { DayContent } from "@/components/day-content";
import { DayStrip } from "@/components/day-strip";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { useEntriesSyncing } from "@/lib/auth";
import { setOpenDay } from "@/lib/active-context";
import { groupByDay } from "@/lib/stats";
import { addDays, dayKey } from "@/lib/format";

const DAYS_BACK = 30;

/**
 * Widok dnia na telefonie: u góry tytuł i pasek dni (przyklejone), niżej treść
 * zaznaczonego dnia (`DayContent`). Domyślnie zaznaczony jest dziś; pusty dziś
 * zaprasza do pisania.
 */
export function MobileDayView() {
  const entries = useEntries();
  const ready = useHydrated();
  const syncing = useEntriesSyncing();

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
      <div className="sticky top-0 z-30 -mx-4 bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-title font-semibold">Dziennik</h1>
        <DayStrip
          className="mt-3"
          days={days}
          selectedKey={selectedKey}
          entriesByDay={entriesByDay}
          onSelect={setSelected}
        />
      </div>

      {/* `key={selectedKey}` remontuje treść przy zmianie dnia → krótkie
          pojawienie się (tylko opacity), które mówi „to inny dzień”. Ograniczony
          ruch i wyłącznik animacji je zerują. */}
      <div
        key={selectedKey}
        className="flex flex-1 flex-col pt-4 duration-(--duration-fast) ease-out animate-in fade-in motion-reduce:animate-none"
      >
        <DayContent
          date={selected}
          entries={dayEntries}
          ready={ready}
          syncing={syncing}
          onBackToToday={() => setSelected(today)}
        />
      </div>
    </div>
  );
}
