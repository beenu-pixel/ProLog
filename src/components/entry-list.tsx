"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EntryListItem } from "@/components/entry-list-item";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { entryMatches } from "@/lib/search";

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

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Dziennik</h1>
          <Link
            href="/new"
            aria-label="Dodaj wpis"
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

      <div className="-mx-3 flex-1 overflow-y-auto px-3 pt-2">
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
    </div>
  );
}
