"use client";

import Link from "next/link";
import { PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DayPulse } from "@/components/day-pulse";
import { PhotoGallery } from "@/components/photo-gallery";
import { LoadingText } from "@/components/ui/loading-dots";
import { sanitizeEntryHtml } from "@/lib/sanitize";
import { startNewEntry } from "@/lib/new-entry";
import { isToday } from "@/lib/stats";
import { formatDayHeading, formatTime } from "@/lib/format";
import type { Entry } from "@/lib/types";

/**
 * Treść jednego dnia — wspólna dla widoku dnia na telefonie i panelu „Dziś” na
 * komputerze. Cztery stany, w tym samym miejscu ekranu (nic nie skacze):
 * - wpisy dnia: data, tytuł, puls dnia, treść, zdjęcia;
 * - trwa pobieranie z chmury: „Wczytuję wpisy” tam, gdzie pojawi się wpis
 *   (brak danych ≠ brak wpisów — pusty stan dopiero, gdy wiadomo, że pusto);
 * - pusty dziś: zaproszenie do pisania z jedną akcją;
 * - pusty dzień w przeszłości: spokojna informacja i powrót do dziś.
 */
export function DayContent({
  date,
  entries,
  ready,
  syncing,
  onBackToToday,
}: {
  date: Date;
  entries: Entry[];
  /** Po hydratacji (wpisy z localStorage są znane). */
  ready: boolean;
  /** Trwa pierwsze pobieranie wpisów z chmury. */
  syncing: boolean;
  /** Powrót do dzisiejszego dnia (pusty dzień w przeszłości). */
  onBackToToday?: () => void;
}) {
  if (!ready) return null;

  if (entries.length > 0) {
    return (
      <div className="space-y-16">
        {entries.map((entry) => (
          <DayEntry key={entry.id} entry={entry} />
        ))}
      </div>
    );
  }

  if (syncing) {
    return <LoadingText className="justify-start">Wczytuję wpisy</LoadingText>;
  }

  if (isToday(date)) return <TodayInvite />;

  return (
    <section className="space-y-4" aria-label={formatDayHeading(date)}>
      <p className="text-body text-muted-foreground">Tego dnia nic nie zapisano.</p>
      {onBackToToday && (
        <Button variant="outline" onClick={onBackToToday}>
          Wróć do dziś
        </Button>
      )}
    </section>
  );
}

/**
 * Pojedynczy wpis dnia. Cały blok prowadzi do szczegółu (tytuł jest linkiem
 * rozciągniętym na wpis), a zdjęcia leżą nad nim, więc stuknięcie w zdjęcie
 * otwiera podgląd, nie szczegół.
 */
function DayEntry({ entry }: { entry: Entry }) {
  return (
    <article className="relative space-y-6">
      <header className="space-y-2">
        <h2 className="text-display font-semibold">
          <Link
            href={`/entries/${entry.id}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ring"
          >
            {entry.title}
          </Link>
        </h2>
        <p className="text-ui text-subtle-foreground">
          <time dateTime={entry.createdAt}>
            {formatDayHeading(entry.createdAt)} · {formatTime(entry.createdAt)}
          </time>
        </p>
      </header>

      <DayPulse entry={entry} />

      {entry.content ? (
        <div
          className="prose-content text-body"
          dangerouslySetInnerHTML={{ __html: sanitizeEntryHtml(entry.content) }}
        />
      ) : entry.photos?.length ? null : (
        <p className="text-ui text-muted-foreground">Bez treści.</p>
      )}

      {entry.photos?.length ? (
        <div className="relative z-10">
          <PhotoGallery photos={entry.photos} />
        </div>
      ) : null}
    </article>
  );
}

/** Pusty dzisiejszy dzień zaprasza do pisania — jedna akcja, nic więcej. */
function TodayInvite() {
  return (
    <section
      aria-labelledby="today-invite-title"
      className="space-y-6 rounded-lg border bg-card p-6"
    >
      <div className="space-y-2">
        <h2 id="today-invite-title" className="text-title font-semibold">
          Jak minął dzień?
        </h2>
        <p className="text-ui text-muted-foreground">
          Pięć krótkich ocen i&nbsp;kilka zdań. Około dwóch minut.
        </p>
      </div>
      <Button asChild className="w-full sm:w-auto">
        <Link href="/new" onClick={startNewEntry}>
          <PenLine className="size-4" aria-hidden />
          Napisz wpis
        </Link>
      </Button>
    </section>
  );
}
