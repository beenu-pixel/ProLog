import { describe, expect, it } from "vitest";

import {
  buildGrid,
  daysInRange,
  entriesInRange,
  groupByDay,
  tileLevel,
  viewRange,
} from "@/lib/stats";
import { dayKey } from "@/lib/format";
import type { Entry } from "@/lib/types";

function at(date: Date, partial: Partial<Entry> = {}): Entry {
  return {
    id: `${date.getTime()}-${Math.random()}`,
    title: "t",
    content: "",
    createdAt: date.toISOString(),
    ...partial,
  };
}

describe("groupByDay", () => {
  it("grupuje wpisy po dniu lokalnym", () => {
    const entries = [
      at(new Date(2026, 5, 10, 9, 0)),
      at(new Date(2026, 5, 10, 20, 0)),
      at(new Date(2026, 5, 11, 8, 0)),
    ];
    const map = groupByDay(entries);
    expect(map.size).toBe(2);
    expect(map.get(dayKey(new Date(2026, 5, 10)))).toHaveLength(2);
    expect(map.get(dayKey(new Date(2026, 5, 11)))).toHaveLength(1);
  });
});

describe("buildGrid", () => {
  it("widok tygodnia = 1 kolumna 7 dni zaczynająca się w poniedziałek", () => {
    const grid = buildGrid("week", new Date(2026, 5, 10)); // środa
    expect(grid).toHaveLength(1);
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0].getDay()).toBe(1); // poniedziałek
    expect(grid[0][6].getDay()).toBe(0); // niedziela
  });

  it("widok miesiąca pokrywa wszystkie dni miesiąca pełnymi tygodniami", () => {
    const grid = buildGrid("month", new Date(2026, 5, 15)); // czerwiec
    expect(grid.length).toBeGreaterThanOrEqual(4);
    expect(grid.length).toBeLessThanOrEqual(6);
    for (const week of grid) {
      expect(week).toHaveLength(7);
      expect(week[0].getDay()).toBe(1); // każdy tydzień startuje w poniedziałek
    }
    const juneDays = grid
      .flat()
      .filter((d) => d.getMonth() === 5)
      .map((d) => d.getDate());
    expect(juneDays).toContain(1);
    expect(juneDays).toContain(30);
  });
});

describe("viewRange", () => {
  it("zakres miesiąca obejmuje 1. dzień do ostatniego", () => {
    const { start, end } = viewRange("month", new Date(2026, 5, 15));
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
    expect(end.getDate()).toBe(30);
    expect(end.getMonth()).toBe(5);
  });

  it("zakres tygodnia to 7 dni od poniedziałku", () => {
    const { start, end } = viewRange("week", new Date(2026, 5, 10));
    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(0);
    expect(daysInRange(start, end)).toHaveLength(7);
  });
});

describe("entriesInRange", () => {
  it("filtruje wpisy po czasie", () => {
    const entries = [
      at(new Date(2026, 5, 5)),
      at(new Date(2026, 5, 15)),
      at(new Date(2026, 6, 1)),
    ];
    const { start, end } = viewRange("month", new Date(2026, 5, 15));
    const inRange = entriesInRange(entries, start, end);
    expect(inRange).toHaveLength(2);
  });
});

describe("tileLevel", () => {
  it("0 dla dnia bez wpisów", () => {
    expect(tileLevel([])).toBe(0);
  });

  it("zaokrąglona średnia samopoczucia", () => {
    expect(tileLevel([at(new Date(), { mood: 4 })])).toBe(4);
    expect(
      tileLevel([
        at(new Date(), { mood: 3 }),
        at(new Date(), { mood: 5 }),
      ])
    ).toBe(4);
  });

  it("poziom bazowy 1, gdy jest wpis bez samopoczucia", () => {
    expect(tileLevel([at(new Date(), {})])).toBe(1);
  });
});
