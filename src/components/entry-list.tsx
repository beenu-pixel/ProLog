"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EntryListItem } from "@/components/entry-list-item";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { entryMatches } from "@/lib/search";
import { playSound } from "@/lib/sound";

/**
 * Lewy panel (lista/kalendarz wpisów) w stylu Stoic: nagłówek z wyszukiwarką
 * i przyciskiem dodawania oraz przewijalna lista wpisów. Na desktopie pełni rolę
 * stałej kolumny master w układzie master-detail; na mobile jest pełnym ekranem.
 */
export function EntryList() {
  const entries = useEntries();
  const ready = useHydrated();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Aktywny wpis = /entries/<id> (także w trybie edycji /entries/<id>/edit).
  const activeId = pathname.startsWith("/entries/")
    ? pathname.split("/")[2]
    : null;

  const filtered = useMemo(
    () =>
      query.trim()
        ? entries.filter((entry) => entryMatches(entry, query))
        : entries,
    [entries, query]
  );

  // Pozycja i wysokość własnego thumba liczone z proporcji przewijania.
  const updateThumb = useCallback(() => {
    const sc = scrollRef.current;
    const th = thumbRef.current;
    if (!sc || !th) return;
    const { scrollTop, scrollHeight, clientHeight } = sc;
    if (scrollHeight <= clientHeight + 1) {
      th.style.height = "0px"; // brak przewijania = brak thumba
      return;
    }
    const thumbH = Math.max(24, (clientHeight / scrollHeight) * clientHeight);
    const maxTop = clientHeight - thumbH;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    th.style.height = `${thumbH}px`;
    th.style.top = `${top}px`;
  }, []);

  // Aktualizacja przy zmianie rozmiaru panelu i listy (filtr/dodanie/usunięcie).
  useEffect(() => {
    updateThumb();
    const sc = scrollRef.current;
    if (!sc) return;
    const ro = new ResizeObserver(updateThumb);
    ro.observe(sc);
    const child = sc.firstElementChild;
    if (child) ro.observe(child);
    window.addEventListener("resize", updateThumb);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateThumb);
    };
  }, [updateThumb, filtered, ready]);

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

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj po tytule lub dacie…"
            aria-label="Szukaj wpisów"
            className="pl-9"
          />
        </div>
      </div>

      <div
        className="custom-scroll-wrap relative -mx-3 min-h-0 flex-1"
        onMouseEnter={(e) => e.currentTarget.classList.add("show-scroll")}
        onMouseLeave={(e) => e.currentTarget.classList.remove("show-scroll")}
      >
        <div
          ref={scrollRef}
          onScroll={updateThumb}
          className="hide-native-scroll absolute inset-0 overflow-y-auto px-3 pt-2"
        >
          {!ready ? null : entries.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">
              Nie masz jeszcze żadnych wpisów.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">
              Brak wpisów pasujących do „{query.trim()}”.
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
        </div>
        <div ref={thumbRef} className="scroll-thumb" aria-hidden />
      </div>
    </div>
  );
}
