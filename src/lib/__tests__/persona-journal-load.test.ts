import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Entry } from "@/lib/types";

// Serwisy z dostępem do Supabase/OpenAI zastępujemy atrapami — bez kluczy i sieci.
const hybridSearch = vi.fn();
const getEntriesInRange = vi.fn();

vi.mock("@/lib/services/search", () => ({ hybridSearch: (...a: unknown[]) => hybridSearch(...a) }));
vi.mock("@/lib/services/journal-entries", () => ({
  getEntriesInRange: (...a: unknown[]) => getEntriesInRange(...a),
}));

const { loadPersonaJournalContext, clipRange } = await import("@/lib/services/persona-journal");

function entry(id: string, day: string): Entry {
  return { id, title: id, content: "", createdAt: `${day}T10:00:00.000Z` };
}

const TODAY = "2026-11-04";

beforeEach(() => {
  hybridSearch.mockReset();
  getEntriesInRange.mockReset();
  hybridSearch.mockResolvedValue([]);
  getEntriesInRange.mockResolvedValue({ entries: [], total: 0 });
});

describe("loadPersonaJournalContext", () => {
  it("pytanie o lipiec pobiera z bazy cały lipiec po user_id, w granicach doby PL", async () => {
    getEntriesInRange.mockResolvedValue({
      entries: [entry("a", "2026-07-02"), entry("b", "2026-07-24")],
      total: 2,
    });
    const ctx = await loadPersonaJournalContext({
      userId: "user-1",
      plan: "pro",
      messages: [{ role: "user", content: "ile wpisów z lipca 2026 widzisz?" }],
      today: TODAY,
    });

    // 1.07 00:00 CEST = 30.06 22:00 UTC; koniec: 1.08 00:00 CEST = 31.07 22:00 UTC.
    expect(getEntriesInRange).toHaveBeenCalledWith(
      "user-1",
      "2026-06-30T22:00:00.000Z",
      "2026-07-31T22:00:00.000Z",
      200
    );
    expect(ctx).toContain("Wpisy z dni 2026-07-01 – 2026-07-31: 2 wpisy — to wszystkie wpisy z tych dni.");
    // Wyszukiwanie dalej działa obok, z głębią planu.
    expect(hybridSearch).toHaveBeenCalledWith("user-1", "ile wpisów z lipca 2026 widzisz?", {
      recentDays: 30,
      limit: 30,
    });
  });

  it("free: zakres na każdym planie, ale z limitem wpisów i dni", async () => {
    await loadPersonaJournalContext({
      userId: "user-1",
      plan: "free",
      messages: [{ role: "user", content: "co pisałem w tym roku?" }],
      today: TODAY,
    });
    const [, start, , limit] = getEntriesInRange.mock.calls[0];
    expect(limit).toBe(31);
    // Rok przycięty do ostatnich 31 dni: od 5.10 (00:00 CEST = 4.10 22:00 UTC).
    expect(start).toBe("2026-10-04T22:00:00.000Z");
    expect(hybridSearch.mock.calls[0][2]).toEqual({ recentDays: 7, limit: 8 });
  });

  it("bez daty w pytaniu bierze zakres z poprzedniego pytania", async () => {
    const ctx = await loadPersonaJournalContext({
      userId: "user-1",
      plan: "pro",
      messages: [
        { role: "user", content: "jak wyglądał lipiec 2026?" },
        { role: "assistant", content: "…" },
        { role: "user", content: "a który dzień miał najgorszy sen?" },
      ],
      today: TODAY,
    });
    expect(getEntriesInRange).toHaveBeenCalledTimes(1);
    expect(ctx).toContain("(okres z wcześniejszego pytania)");
  });

  it("bez żadnej daty: tylko wyszukiwanie, bez zapytań po zakresie", async () => {
    hybridSearch.mockResolvedValue([{ entry: entry("x", "2026-11-03"), source: "recent" }]);
    const ctx = await loadPersonaJournalContext({
      userId: "user-1",
      plan: "pro",
      messages: [{ role: "user", content: "co myślisz o moich nawykach?" }],
      today: TODAY,
    });
    expect(getEntriesInRange).not.toHaveBeenCalled();
    expect(ctx).toContain("To tylko wybór, nie cały dziennik.");
  });

  it("wyszukiwanie padło, ale zakres jest — persona i tak dostaje wpisy z okresu", async () => {
    hybridSearch.mockRejectedValue(new Error("Brak OPENAI_API_KEY"));
    getEntriesInRange.mockResolvedValue({ entries: [entry("a", "2026-07-24")], total: 1 });
    const ctx = await loadPersonaJournalContext({
      userId: "user-1",
      plan: "pro",
      messages: [{ role: "user", content: "24.07.2026" }],
      today: TODAY,
    });
    expect(ctx).toContain("Wyszukiwanie najtrafniejszych wpisów jest chwilowo niedostępne.");
    expect(ctx).toContain("Wpisy z dnia 2026-07-24: 1 wpis");
  });

  it("nic się nie udało → null (wołający wraca do zapasowego źródła)", async () => {
    hybridSearch.mockRejectedValue(new Error("down"));
    getEntriesInRange.mockRejectedValue(new Error("db down"));
    expect(
      await loadPersonaJournalContext({
        userId: "user-1",
        plan: "pro",
        messages: [{ role: "user", content: "co w lipcu?" }],
        today: TODAY,
      })
    ).toBeNull();
    expect(
      await loadPersonaJournalContext({
        userId: "user-1",
        plan: "pro",
        messages: [{ role: "user", content: "jak się masz" }],
        today: TODAY,
      })
    ).toBeNull();
  });

  it("zakresy z pól REST (`extraRanges`) są pobierane obok tych z pytania", async () => {
    await loadPersonaJournalContext({
      userId: "user-1",
      plan: "pro",
      messages: [{ role: "user", content: "podsumuj" }],
      extraRanges: [{ from: "2026-07-27", to: "2026-07-31" }],
      today: TODAY,
    });
    expect(getEntriesInRange).toHaveBeenCalledWith(
      "user-1",
      "2026-07-26T22:00:00.000Z",
      "2026-07-31T22:00:00.000Z",
      200
    );
  });
});

describe("clipRange", () => {
  it("zostawia krótki zakres, długi przycina do końca", () => {
    expect(clipRange({ from: "2026-07-01", to: "2026-07-31" }, 31)).toEqual({
      range: { from: "2026-07-01", to: "2026-07-31" },
    });
    expect(clipRange({ from: "2026-01-01", to: "2026-03-31" }, 31)).toEqual({
      range: { from: "2026-03-01", to: "2026-03-31" },
      requested: { from: "2026-01-01", to: "2026-03-31" },
    });
  });
});
