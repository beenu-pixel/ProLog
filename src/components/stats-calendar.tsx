"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayKey } from "@/lib/format";
import { tileLevel, isToday, type StatsView } from "@/lib/stats";
import type { Entry } from "@/lib/types";

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

interface StatsCalendarProps {
  view: StatsView;
  periodLabel: string;
  /** Kolumny-tygodnie, każda po 7 dni (pon–niedz). */
  grid: Date[][];
  /** Miesiąc kotwicy (0–11) do wyszarzenia dni spoza miesiąca w widoku „month". */
  anchorMonth: number;
  dayMap: Map<string, Entry[]>;
  selectedKey: string | null;
  onSelect: (date: Date) => void;
  onSetView: (view: StatsView) => void;
  onNavigate: (dir: -1 | 1) => void;
}

export function StatsCalendar({
  view,
  periodLabel,
  grid,
  anchorMonth,
  dayMap,
  selectedKey,
  onSelect,
  onSetView,
  onNavigate,
}: StatsCalendarProps) {
  const isMonth = view === "month";

  return (
    <div className="space-y-4">
      {/* Przełącznik widoku — osobny wiersz na górze (pełny rozmiar) */}
      <div className="flex">
        <div className="flex rounded-full border p-0.5 text-sm">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onSetView(v)}
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                view === v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "week" ? "Tydzień" : "Miesiąc"}
            </button>
          ))}
        </div>
      </div>

      {/* Nawigacja okresu — bezpośrednio nad kalendarzem, strzałki przy krawędziach */}
      <div className="flex items-center justify-between gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Poprzedni okres"
          onClick={() => onNavigate(-1)}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span className="flex-1 text-center text-sm font-medium">
          {periodLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Następny okres"
          onClick={() => onNavigate(1)}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="flex h-9 items-center text-[10px] text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((date) => {
              const key = dayKey(date);
              const entries = dayMap.get(key) ?? [];
              const has = entries.length > 0;
              const level = tileLevel(entries);
              const inMonth = isMonth ? date.getMonth() === anchorMonth : true;
              const selected = key === selectedKey;
              const bg = has
                ? `color-mix(in oklch, var(--foreground) ${10 + level * 18}%, transparent)`
                : undefined;
              const numClass = !has
                ? "text-muted-foreground/60"
                : level >= 3
                  ? "text-background"
                  : "text-foreground";

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!has}
                  onClick={() => onSelect(date)}
                  title={`${key} — ${entries.length} ${
                    entries.length === 1 ? "wpis" : "wpisy/ów"
                  }`}
                  aria-label={`${key}, ${entries.length} wpisów`}
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-md border text-xs tabular-nums outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-ring/50",
                    has
                      ? "cursor-pointer border-transparent hover:ring-2 hover:ring-ring/40"
                      : "cursor-default border-border",
                    selected && "ring-2 ring-foreground",
                    !inMonth && "opacity-40",
                    numClass
                  )}
                  style={{ backgroundColor: bg }}
                >
                  {date.getDate()}
                  {isToday(date) && (
                    <span className="absolute bottom-0.5 size-1 rounded-full bg-current" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
