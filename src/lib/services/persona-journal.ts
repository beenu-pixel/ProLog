import { dayRangeUtc, todayWarsaw } from "@/lib/api-day";
import { addDays, parsePolishDateRanges, rangeLength, type DayRange } from "@/lib/date-range-pl";
import { dateRangeDepth, ragDepth, type PlanTier } from "@/lib/plans";
import { hybridSearch, type SearchHit } from "@/lib/services/search";
import { getEntriesInRange } from "@/lib/services/journal-entries";
import { buildPersonaJournalContext, type RangeSlice } from "@/lib/therapist-context";

// Wpisy dziennika dla rozmowy z personą (czat w aplikacji i agent REST/MCP).
//
// Samo wyszukiwanie wektorowe zwraca najtrafniejsze wpisy i ostatnie dni — na
// pytanie „ile wpisów z lipca" albo „co było 27–31.07" to za mało (persona
// widziała 3 z 18 wpisów i twierdziła, że dni bez trafień są puste). Gdy
// wiadomość wskazuje datę lub okres, dociągamy więc z bazy WSZYSTKIE wpisy
// z tego zakresu (po `user_id`, z limitem planu), a wyniki wyszukiwania
// dokładamy obok jako wybór.

export interface PersonaTurn {
  role: "user" | "assistant";
  content: string;
}

export interface PersonaJournalParams {
  userId: string;
  plan: PlanTier;
  /** Rozmowa; ostatnia wiadomość użytkownika to pytanie. */
  messages: PersonaTurn[];
  /** Zakresy podane wprost (np. `day`/`from`/`to` w REST agenta). */
  extraRanges?: DayRange[];
  /** Klucz dnia „dziś" (Europe/Warsaw) — wstrzykiwany w testach. */
  today?: string;
}

/** Przycina zakres do `maxDays` ostatnich dni (zachowując jego koniec). */
export function clipRange(range: DayRange, maxDays: number): { range: DayRange; requested?: DayRange } {
  if (rangeLength(range) <= maxDays) return { range };
  return { range: { from: addDays(range.to, -(maxDays - 1)), to: range.to }, requested: range };
}

/** Zakresy z bieżącego pytania, a gdy go brak — z poprzedniego pytania użytkownika. */
function rangesFromConversation(
  messages: PersonaTurn[],
  today: string
): { ranges: DayRange[]; fromEarlier: boolean } {
  const userTurns = messages.filter((m) => m.role === "user");
  const last = userTurns[userTurns.length - 1]?.content ?? "";
  const current = parsePolishDateRanges(last, today);
  if (current.length > 0) return { ranges: current, fromEarlier: false };
  // „A który dzień miał najgorszy sen?" po pytaniu o lipiec dotyczy dalej lipca.
  const previous = userTurns[userTurns.length - 2]?.content ?? "";
  return { ranges: parsePolishDateRanges(previous, today), fromEarlier: true };
}

/**
 * Buduje tekst z wpisami dla persony. Zwraca `null`, gdy nie udało się pobrać
 * niczego (wyszukiwanie padło i nie było zakresu dat) — wołający zostaje wtedy
 * przy swoim zapasowym źródle (pełny dziennik od klienta albo z bazy).
 */
export async function loadPersonaJournalContext(params: PersonaJournalParams): Promise<string | null> {
  const today = params.today ?? todayWarsaw();
  const userTurns = params.messages.filter((m) => m.role === "user");
  const question = userTurns[userTurns.length - 1]?.content ?? "";

  const { ranges: parsed, fromEarlier } = rangesFromConversation(params.messages, today);
  const all: { range: DayRange; fromEarlier: boolean }[] = [
    ...(params.extraRanges ?? []).map((range) => ({ range, fromEarlier: false })),
    ...parsed.map((range) => ({ range, fromEarlier })),
  ];
  const unique = all.filter(
    (r, i) => all.findIndex((o) => o.range.from === r.range.from && o.range.to === r.range.to) === i
  );

  const depth = dateRangeDepth(params.plan);
  const rag = ragDepth(params.plan);

  const searchPromise: Promise<SearchHit[] | null> = question.trim()
    ? hybridSearch(params.userId, question, { recentDays: rag.recentDays, limit: rag.limit }).catch(
        (err) => {
          console.error("[persona-journal] hybrid search failed:", err);
          return null;
        }
      )
    : Promise.resolve(null);

  const slicePromises = unique.map(async ({ range: wanted, fromEarlier: earlier }) => {
    const { range, requested } = clipRange(wanted, depth.maxDays);
    try {
      const { startUtc } = dayRangeUtc(range.from);
      const { endUtc } = dayRangeUtc(range.to);
      const { entries, total } = await getEntriesInRange(
        params.userId,
        startUtc,
        endUtc,
        depth.maxEntries
      );
      const slice: RangeSlice = {
        range,
        requested,
        total,
        entries,
        fullEntries: depth.fullEntries,
        fromEarlierMessage: earlier || undefined,
      };
      return slice;
    } catch (err) {
      console.error("[persona-journal] range fetch failed:", range, err);
      return null;
    }
  });

  const [hits, ...maybeSlices] = await Promise.all([searchPromise, ...slicePromises]);
  const slices = maybeSlices.filter((s): s is RangeSlice => s !== null);

  if (hits === null && slices.length === 0) return null;
  return buildPersonaJournalContext({ slices, hits });
}
