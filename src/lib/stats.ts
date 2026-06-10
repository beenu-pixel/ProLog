import type { Entry } from "@/lib/types";
import { averageMetric } from "@/lib/metrics";
import { addDays, dayKey, isSameDay, startOfWeek } from "@/lib/format";

export type StatsView = "week" | "month";

/** Grupuje wpisy po dniu (klucz „YYYY-MM-DD"). */
export function groupByDay(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = dayKey(entry.createdAt);
    const bucket = map.get(key);
    if (bucket) bucket.push(entry);
    else map.set(key, [entry]);
  }
  return map;
}

/**
 * Siatka heatmapy jako lista kolumn-tygodni; każdy tydzień to 7 dni (pon–niedz).
 * Widok „week" = 1 tydzień; „month" = wszystkie tygodnie pokrywające miesiąc
 * (dopełnione do pełnych tygodni).
 */
export function buildGrid(view: StatsView, anchor: Date): Date[][] {
  if (view === "week") {
    const start = startOfWeek(anchor);
    return [Array.from({ length: 7 }, (_, i) => addDays(start, i))];
  }

  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  let cursor = startOfWeek(firstOfMonth);
  while (cursor <= lastOfMonth) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** Zakres widocznego okresu [start 00:00, end 23:59:59.999]. */
export function viewRange(view: StatsView, anchor: Date): { start: Date; end: Date } {
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Lista kolejnych dni w zakresie (włącznie). */
export function daysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Wpisy mieszczące się w zakresie czasu. */
export function entriesInRange(entries: Entry[], start: Date, end: Date): Entry[] {
  const from = start.getTime();
  const to = end.getTime();
  return entries.filter((entry) => {
    const t = new Date(entry.createdAt).getTime();
    return t >= from && t <= to;
  });
}

/**
 * Poziom intensywności kafelka (0–5) wg średniego samopoczucia dnia.
 * 0 = brak wpisu; wpis bez `mood` → poziom bazowy 1.
 */
export function tileLevel(dayEntries: Entry[]): number {
  if (dayEntries.length === 0) return 0;
  const avg = averageMetric(dayEntries, "mood");
  if (avg === null) return 1;
  return Math.min(5, Math.max(1, Math.round(avg)));
}

/** Czy data wypada dzisiaj. */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
