"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Plus, Search, Sparkles } from "lucide-react";

import { Input } from "@/components/ui/input";
import { CustomScroll } from "@/components/custom-scroll";
import { EntryListItem } from "@/components/entry-list-item";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAiLimit, noteFromHeaders } from "@/hooks/use-ai-limits";
import { useSession, getAccessToken } from "@/lib/auth";
import { searchEntries } from "@/lib/search";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { Entry } from "@/lib/types";

// Maska wytapiająca górną i dolną krawędź listy (krótko i subtelnie).
const ENTRY_LIST_MASK =
  "linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 44px), transparent 100%)";

/** Źródło wpisu w wynikach hybrydowych (lustro `SearchSource` z serwisu). */
type SearchSource = "search" | "recent" | "both";
interface SearchHit {
  entry: Entry;
  source: SearchSource;
}

/**
 * Lewy panel (lista/kalendarz wpisów) w stylu Stoic: nagłówek z wyszukiwarką
 * i przyciskiem dodawania oraz przewijalna lista wpisów. Na desktopie pełni rolę
 * stałej kolumny master w układzie master-detail; na mobile jest pełnym ekranem.
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

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Dziennik</h1>
          <Link
            href="/new"
            aria-label="Dodaj wpis"
            onClick={() => playSound("entry-new")}
            className="hidden size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 lg:inline-flex"
          >
            <Plus className="size-5" />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                smart
                  ? "Zapytaj po znaczeniu lub o ostatnie dni…"
                  : "Szukaj po tytule lub dacie…"
              }
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
                "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                searchLimit.blocked && "cursor-not-allowed opacity-50",
                smart
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="size-4" />
            </button>
          )}
        </div>

        {/* Ostrzeżenie o zbliżającym się / wyczerpanym dziennym limicie wyszukiwań. */}
        {loggedIn && smart && (searchLimit.blocked || searchLimit.nearLimit) && (
          <p className="px-1 text-xs text-muted-foreground">
            {searchLimit.blocked
              ? "Dzienny limit inteligentnego wyszukiwania wykorzystany — odnowi się o północy."
              : `Zostało ${searchLimit.remaining} wyszukiwań na dziś.`}
          </p>
        )}
      </div>

      <CustomScroll
        className="-mx-3 min-h-0 flex-1"
        contentClassName="h-full px-3 pt-2 pb-6"
        // Subtelny, krótki fade krawędzi: u góry króciutko (14 px), u dołu nieco
        // dłużej (44 px), żeby wpisy znikały stopniowo zamiast urywać się ostro.
        contentStyle={{
          WebkitMaskImage: ENTRY_LIST_MASK,
          maskImage: ENTRY_LIST_MASK,
        }}
      >
        {!ready ? null : smartActive ? (
          searching && hits === null ? (
            <p className="flex items-center justify-center gap-2 px-3 py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Szukam…
            </p>
          ) : searchError ? (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">
              Wyszukiwanie chwilowo niedostępne. Spróbuj ponownie.
            </p>
          ) : hits && hits.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">
              Brak dopasowań do „{trimmed}”.
            </p>
          ) : (
            <ul className="space-y-1">
              {hits?.map((hit) => (
                <EntryListItem
                  key={hit.entry.id}
                  entry={hit.entry}
                  active={hit.entry.id === activeId}
                  badge={hit.source === "recent" ? "ostatnie 7 dni" : undefined}
                />
              ))}
            </ul>
          )
        ) : entries.length === 0 ? (
          <p className="px-3 py-12 text-center text-sm text-muted-foreground">
            Nie masz jeszcze żadnych wpisów.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-12 text-center text-sm text-muted-foreground">
            Brak wpisów pasujących do „{trimmed}”.
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((entry) => (
              <EntryListItem
                key={entry.id}
                entry={entry}
                active={entry.id === activeId}
              />
            ))}
          </ul>
        )}
      </CustomScroll>
    </div>
  );
}
