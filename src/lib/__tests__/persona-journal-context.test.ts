import { describe, expect, it } from "vitest";

import {
  buildJournalContextFromHits,
  buildPersonaJournalContext,
  entriesWord,
  type RangeSlice,
} from "@/lib/therapist-context";
import type { SearchHit } from "@/lib/services/search";
import type { Entry } from "@/lib/types";

/** Wpis z danego dnia (południe czasu polskiego → zawsze ten sam dzień). */
function entry(id: string, day: string, extra: Partial<Entry> = {}): Entry {
  return {
    id,
    title: `Wpis ${id}`,
    content: `<p>Treść ${id}</p>`,
    createdAt: `${day}T10:00:00.000Z`,
    ...extra,
  };
}

/** 18 lipcowych wpisów, jak na koncie ze zgłoszenia (w tym 24.07 ze snem 1/5). */
function july(): Entry[] {
  const days = [1, 2, 4, 6, 8, 9, 11, 13, 15, 17, 19, 20, 22, 24, 27, 28, 30, 31];
  return days.map((d) =>
    entry(`j${d}`, `2026-07-${String(d).padStart(2, "0")}`, d === 24 ? { sleep: 1 } : { sleep: 4 })
  );
}

function slice(overrides: Partial<RangeSlice> & Pick<RangeSlice, "range">): RangeSlice {
  const entries = overrides.entries ?? [];
  return { total: entries.length, entries, fullEntries: 40, ...overrides };
}

describe("buildPersonaJournalContext — zakres dat", () => {
  const ctx = buildPersonaJournalContext({
    slices: [slice({ range: { from: "2026-07-01", to: "2026-07-31" }, entries: july() })],
    hits: [],
  });

  it("podaje dokładną liczbę wpisów z okresu i że to wszystkie", () => {
    expect(ctx).toContain("Wpisy z dni 2026-07-01 – 2026-07-31: 18 wpisów — to wszystkie wpisy z tych dni.");
  });

  it("wymienia dni bez wpisu (27–31.07 mają wpisy, więc nie są na liście)", () => {
    const line = ctx.split("\n").find((l) => l.includes("Dni bez wpisu"))!;
    expect(line).toContain("2026-07-03");
    expect(line).toContain("2026-07-29");
    for (const d of ["2026-07-24", "2026-07-27", "2026-07-28", "2026-07-30", "2026-07-31"]) {
      expect(line).not.toContain(d);
    }
  });

  it("zawiera wpis z najgorszym snem (24.07, 1/5)", () => {
    expect(ctx).toContain("[2026-07-24] piątek — „Wpis j24\"");
    expect(ctx).toMatch(/\[2026-07-24\][^\n]*\nMetryki: [^\n]*Jakość snu: 1\/5/);
  });

  it("pozwala mówić o braku wpisu tylko w pobranym okresie", () => {
    expect(ctx).toContain(
      "Że jakiegoś dnia nie ma wpisu, możesz powiedzieć tylko o dniach z okresów: 2026-07-01 – 2026-07-31."
    );
    expect(ctx).toContain("O innych dniach widzisz tylko część dziennika");
  });

  it("nie używa słowa „kontekst”", () => {
    expect(ctx.toLowerCase()).not.toContain("kontekst");
  });
});

describe("buildPersonaJournalContext — przycinanie i wybór", () => {
  it("informuje o przycięciu do limitu wpisów i nie listuje dni bez wpisu", () => {
    const entries = july().slice(0, 10);
    const ctx = buildPersonaJournalContext({
      slices: [
        slice({ range: { from: "2026-07-01", to: "2026-07-31" }, entries, total: 18, fullEntries: 4 }),
      ],
      hits: [],
    });
    expect(ctx).toContain("w dzienniku jest ich 18, dostajesz 10 (limit planu)");
    expect(ctx).not.toContain("Dni bez wpisu");
    expect(ctx).toContain("Pełną treść ma 4 wpisy; pozostałe są skrócone do daty, tytułu i metryk.");
    expect(ctx.match(/\(bez treści\)/g)).toHaveLength(6);
    // Przycięty okres nie jest „kompletny" — o brakach nie wolno mówić.
    expect(ctx).toContain("Widzisz tylko część dziennika.");
  });

  it("informuje o przycięciu zakresu do limitu dni planu", () => {
    const ctx = buildPersonaJournalContext({
      slices: [
        slice({
          range: { from: "2026-10-05", to: "2026-11-04" },
          requested: { from: "2026-01-01", to: "2026-11-04" },
          entries: [entry("a", "2026-10-10")],
        }),
      ],
      hits: [],
    });
    expect(ctx).toContain(
      "Pytanie obejmuje dni 2026-01-01 – 2026-11-04, ale pobrano tylko ostatnie 31 dni tego okresu (2026-10-05 – 2026-11-04)."
    );
  });

  it("pusty okres: wprost „brak”", () => {
    const ctx = buildPersonaJournalContext({
      slices: [slice({ range: { from: "2026-07-27", to: "2026-07-31" } })],
      hits: [],
    });
    expect(ctx).toContain("Wpisy z dni 2026-07-27 – 2026-07-31: brak. W dzienniku nie ma żadnego wpisu z tych dni.");
  });

  it("wybrane wpisy z wyszukiwania nie dublują wpisów z okresu", () => {
    const inRange = entry("j24", "2026-07-24");
    const other = entry("s1", "2026-03-02");
    const hits: SearchHit[] = [
      { entry: inRange, source: "search" },
      { entry: other, source: "search" },
    ];
    const ctx = buildPersonaJournalContext({
      slices: [slice({ range: { from: "2026-07-24", to: "2026-07-24" }, entries: [inRange] })],
      hits,
    });
    expect(ctx).toContain("Wpisy z dnia 2026-07-24: 1 wpis — to wszystkie wpisy z tego dnia.");
    expect(ctx).toContain("Wybrane wpisy: najtrafniejsze dla pytania oraz z ostatnich dni — 1 wpis spoza okresów powyżej.");
    expect(ctx.match(/„Wpis j24"/g)).toHaveLength(1);
  });

  it("bez zakresu: tylko wybór, zakaz twierdzenia o brakach", () => {
    const ctx = buildPersonaJournalContext({
      hits: [{ entry: entry("s1", "2026-11-03"), source: "recent" }],
    });
    expect(ctx).toContain("To tylko wybór, nie cały dziennik.");
    expect(ctx).toContain("Nie twierdź, że jakiegoś dnia nie ma wpisu");
  });

  it("brak trafień nie znaczy pustego dziennika", () => {
    const ctx = buildJournalContextFromHits([]);
    expect(ctx).toContain("Nie znaczy to, że dziennik jest pusty.");
    expect(ctx).not.toContain("nie ma jeszcze żadnych wpisów");
  });

  it("padnięte wyszukiwanie przy pobranym okresie — mówi o tym i dalej daje okres", () => {
    const ctx = buildPersonaJournalContext({
      slices: [slice({ range: { from: "2026-07-01", to: "2026-07-31" }, entries: july() })],
      hits: null,
    });
    expect(ctx).toContain("Wyszukiwanie najtrafniejszych wpisów jest chwilowo niedostępne.");
    expect(ctx).toContain("18 wpisów — to wszystkie wpisy z tych dni.");
  });

  it("nagłówek wpisu liczy dzień wg czasu polskiego, nie strefy serwera", () => {
    // 23:30 UTC 31.07 to już 1 sierpnia w Polsce (CEST, UTC+2).
    const late = entry("late", "2026-07-31", { createdAt: "2026-07-31T23:30:00.000Z" });
    const ctx = buildPersonaJournalContext({ hits: [{ entry: late, source: "search" }] });
    expect(ctx).toContain("[2026-08-01] sobota — „Wpis late\"");
  });
});

describe("entriesWord — odmiana", () => {
  it.each([
    [1, "1 wpis"],
    [2, "2 wpisy"],
    [4, "4 wpisy"],
    [5, "5 wpisów"],
    [12, "12 wpisów"],
    [18, "18 wpisów"],
    [22, "22 wpisy"],
    [0, "0 wpisów"],
  ])("%d → %s", (n, word) => {
    expect(entriesWord(n)).toBe(word);
  });
});
