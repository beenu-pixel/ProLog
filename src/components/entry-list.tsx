"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Sparkles } from "lucide-react";

import { Input } from "@/components/ui/input";
import { LoadingText } from "@/components/ui/loading-dots";
import { CustomScroll } from "@/components/custom-scroll";
import { EntryListItem } from "@/components/entry-list-item";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAiLimit, noteFromHeaders } from "@/hooks/use-ai-limits";
import { useEntriesSyncing, useSession, getAccessToken } from "@/lib/auth";
import { searchEntries } from "@/lib/search";
import { groupByMonth } from "@/lib/stats";
import { dayKey, formatDayNumber, formatMonthHeading } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Entry } from "@/lib/types";

// Dół listy wytapia się krótko, żeby było widać, że jest więcej wpisów. Góra
// zostaje ostra — przyklejają się do niej nagłówki miesięcy.
const ENTRY_LIST_MASK =
  "linear-gradient(to bottom, #000 calc(100% - 40px), transparent 100%)";

/** Źródło wpisu w wynikach hybrydowych (lustro `SearchSource` z serwisu). */
type SearchSource = "search" | "recent" | "both";
interface SearchHit {
  entry: Entry;
  source: SearchSource;
}

/**
 * Lewa kolumna Dziennika na komputerze: tytuł, wyszukiwarka i lista wpisów
 * pogrupowana po miesiącach. Na górze zawsze „Dziś” — gdy dzisiejszego wpisu
 * jeszcze nie ma, wiersz zaprasza do pisania (prowadzi do panelu dnia).
 * Dodawanie wpisu ma jedną afordancję w pasku bocznym („Nowy wpis”).
 *
 * Dwa tryby wyszukiwania: lokalny (filtr localStorage przez `entryMatches`, dla
 * każdego) oraz inteligentny/hybrydowy (wektor + full-text + kontekst 7 dni przez
 * `/api/search`, tylko dla zalogowanych — przełącznik z ikoną Sparkles).
 */
export function EntryList() {
  const entries = useEntries();
  const ready = useHydrated();
  const pathname = usePathname();
  const session = useSession();
  const loggedIn = Boolean(session);
  const syncing = useEntriesSyncing();
  const [query, setQuery] = useState("");
  const [smart, setSmart] = useState(false);
  const searchLimit = useAiLimit("search");

  // Wyniki trybu inteligentnego (null = brak/nieaktywny).
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  // Aktywny wpis = /entries/<id> (także w trybie edycji /entries/<id>/edit).
  const activeId = pathname.startsWith("/entries/")
    ? pathname.split("/")[2]
    : null;

  const trimmed = query.trim();
  const smartActive = smart && loggedIn && trimmed.length > 0;

  // Filtr lokalny (tryb zwykły) — filtruje i porządkuje wg trafności:
  // dopasowania po dacie nad tymi, które tylko zawierają szukaną liczbę w treści.
  const filtered = useMemo(
    () => (trimmed ? searchEntries(entries, query) : entries),
    [entries, query, trimmed]
  );

  // Tryb inteligentny: debounce zapytania → POST /api/search (token sesji).
  // Wszystkie setState są w callbacku timera (asynchronicznie), więc nie wywołują
  // kaskadowych renderów. Gdy tryb nieaktywny — efekt nic nie robi, a render i tak
  // czyta `hits` tylko przy `smartActive`, więc resetowanie stanu jest zbędne.
  useEffect(() => {
    if (!smartActive) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no-session");
        const res = await fetch("/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query: trimmed }),
        });
        noteFromHeaders("search", res); // odśwież stan limitu (też przy 429)
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { hits?: SearchHit[] };
        if (!cancelled) setHits(data.hits ?? []);
      } catch {
        if (!cancelled) {
          setHits([]);
          setSearchError(true);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [smartActive, trimmed]);

  // Dziś bez wpisu → wiersz-zaproszenie nad listą (z filtrem wyszukiwania znika).
  const todayKey = dayKey(new Date());
  const hasToday = entries.some((entry) => dayKey(entry.createdAt) === todayKey);
  const showTodayRow = ready && !trimmed && !hasToday && !(syncing && entries.length === 0);
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 px-1 pb-3">
        <h1 className="text-title font-semibold">Dziennik</h1>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={smart ? "Szukaj po znaczeniu…" : "Szukaj we wpisach…"}
              aria-label="Szukaj wpisów"
              className="pl-9"
            />
          </div>

          {/* Przełącznik inteligentnego wyszukiwania — tylko dla zalogowanych.
              Wyłączony, gdy wyczerpano dzienny limit wyszukiwań. */}
          {loggedIn && (
            <button
              type="button"
              onClick={() => setSmart((v) => !v)}
              disabled={searchLimit.blocked}
              aria-pressed={smart}
              aria-label="Inteligentne wyszukiwanie"
              title={
                searchLimit.blocked
                  ? "Dzienny limit inteligentnego wyszukiwania wykorzystany — odnowi się o północy"
                  : smart
                    ? "Inteligentne wyszukiwanie (znaczenie + ostatnie 7 dni) — włączone"
                    : "Włącz inteligentne wyszukiwanie (znaczenie + ostatnie 7 dni)"
              }
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full border border-input transition-colors",
                searchLimit.blocked && "cursor-not-allowed opacity-50",
                smart
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Sparkles className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Ostrzeżenie o zbliżającym się / wyczerpanym dziennym limicie wyszukiwań. */}
        {loggedIn && smart && (searchLimit.blocked || searchLimit.nearLimit) && (
          <p className="text-caption text-muted-foreground">
            {searchLimit.blocked
              ? "Dzienny limit inteligentnego wyszukiwania wykorzystany — odnowi się o północy."
              : `Zostało ${searchLimit.remaining} wyszukiwań na dziś.`}
          </p>
        )}
      </div>

      <CustomScroll
        className="-mx-3 min-h-0 flex-1"
        contentClassName="h-full px-3 pb-8"
        contentStyle={{
          WebkitMaskImage: ENTRY_LIST_MASK,
          maskImage: ENTRY_LIST_MASK,
        }}
      >
        {!ready ? null : smartActive ? (
          // Puste poprzednie wyniki nie mogą mówić „Brak dopasowań" o nowym zapytaniu.
          searching && !hits?.length ? (
            <LoadingText className="justify-start px-3 py-4">Szukam</LoadingText>
          ) : searchError ? (
            <ListNote>Wyszukiwanie chwilowo niedostępne. Spróbuj ponownie.</ListNote>
          ) : hits && hits.length === 0 ? (
            <ListNote>Brak dopasowań do „{trimmed}”.</ListNote>
          ) : (
            <>
              {searching && (
                <LoadingText className="justify-start px-3 pb-3">Szukam</LoadingText>
              )}
              <ul
                className={cn(
                  "space-y-1 transition-opacity",
                  searching && "opacity-50"
                )}
              >
                {hits?.map((hit) => (
                  <EntryListItem
                    key={hit.entry.id}
                    entry={hit.entry}
                    active={hit.entry.id === activeId}
                    badge={hit.source === "recent" ? "ostatnie 7 dni" : undefined}
                  />
                ))}
              </ul>
            </>
          )
        ) : (
          <>
            {showTodayRow && <TodayRow active={pathname === "/entries"} />}
            {entries.length === 0 ? (
              syncing ? (
                <LoadingText className="justify-start px-3 py-4">Wczytuję wpisy</LoadingText>
              ) : (
                <ListNote>Tu pojawią się Twoje wpisy.</ListNote>
              )
            ) : filtered.length === 0 ? (
              <ListNote>Brak wpisów pasujących do „{trimmed}”.</ListNote>
            ) : (
              groups.map((group) => (
                <section key={`${group.key}-${group.entries[0].id}`} aria-label={formatMonthHeading(group.firstCreatedAt)}>
                  <h2 className="sticky top-0 z-10 bg-background px-3 pt-4 pb-2 text-caption font-semibold text-subtle-foreground">
                    {formatMonthHeading(group.firstCreatedAt)}
                  </h2>
                  <ul className="space-y-1">
                    {group.entries.map((entry) => (
                      <EntryListItem
                        key={entry.id}
                        entry={entry}
                        active={entry.id === activeId}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </CustomScroll>
    </div>
  );
}

function ListNote({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-4 text-ui text-muted-foreground">{children}</p>;
}

/** Dzisiejszy dzień bez wpisu — wiersz-zaproszenie na górze listy. */
function TodayRow({ active }: { active: boolean }) {
  const now = new Date().toISOString();
  return (
    <Link
      href="/entries"
      aria-current={active ? "page" : undefined}
      className={cn(
        "mt-1 grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 rounded-md border border-dashed border-input px-3 py-3 transition-colors",
        active ? "bg-accent" : "hover:bg-accent"
      )}
    >
      <span className="flex flex-col items-start">
        <span className="font-mono text-title font-semibold tabular-nums">
          {formatDayNumber(now)}
        </span>
        <span className="text-caption font-semibold text-foreground">dziś</span>
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-ui font-semibold">Jeszcze bez wpisu</span>
        <span className="text-ui text-muted-foreground">Jak minął dzień?</span>
      </span>
    </Link>
  );
}
