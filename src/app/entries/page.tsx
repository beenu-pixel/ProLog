"use client";

import { useMemo, useState } from "react";

import { DayContent } from "@/components/day-content";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { useEntriesSyncing } from "@/lib/auth";
import { dayKey } from "@/lib/format";

/**
 * Prawy panel Dziennika na komputerze, gdy żaden wpis nie jest wybrany: dzisiejszy
 * dzień — jego wpisy albo zaproszenie do pisania. Na telefonie ten panel jest
 * ukryty przez layout (widok dnia ma własny pasek dni).
 */
export default function EntriesIndexPage() {
  const entries = useEntries();
  const ready = useHydrated();
  const syncing = useEntriesSyncing();
  const [today] = useState(() => new Date());

  const todayKey = dayKey(today);
  const todays = useMemo(
    () => entries.filter((entry) => dayKey(entry.createdAt) === todayKey),
    [entries, todayKey]
  );

  return (
    <div className="mx-auto w-full max-w-3xl duration-(--duration-fast) ease-out animate-in fade-in motion-reduce:animate-none">
      <DayContent date={today} entries={todays} ready={ready} syncing={syncing} />
    </div>
  );
}
