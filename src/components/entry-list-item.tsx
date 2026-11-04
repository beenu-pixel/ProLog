import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";

import { Meter } from "@/components/meter";
import { cn } from "@/lib/utils";
import { metricLevelLabel, needsAttention } from "@/lib/metrics";
import { formatDayNumber, formatWeekdayTiny, toExcerpt } from "@/lib/format";
import type { Entry } from "@/lib/types";

/**
 * Wiersz listy wpisów: liczba dnia z dniem tygodnia po lewej, tytuł i początek
 * treści pośrodku, po prawej drobny miernik nastroju (dane mówią kierunkiem już
 * na liście). Miesiąc stoi raz, w nagłówku grupy — nie przy każdym wpisie.
 */
export function EntryListItem({
  entry,
  active = false,
  badge,
}: {
  entry: Entry;
  active?: boolean;
  /** Opcjonalna mała etykieta (np. „ostatnie 7 dni") — używana w trybie inteligentnego wyszukiwania. */
  badge?: string;
}) {
  const excerpt = toExcerpt(entry.content, 90);
  const hasPhotos = (entry.photos?.length ?? 0) > 0;
  const mood = entry.mood;

  return (
    <li>
      <Link
        href={`/entries/${entry.id}`}
        aria-current={active ? "true" : undefined}
        className={cn(
          "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-3 rounded-md px-3 py-3 transition-colors",
          active ? "bg-accent" : "hover:bg-accent"
        )}
      >
        <span className="flex flex-col items-start">
          <span className="font-mono text-title font-semibold tabular-nums">
            {formatDayNumber(entry.createdAt)}
          </span>
          <span className="text-caption text-subtle-foreground">
            {formatWeekdayTiny(entry.createdAt)}
          </span>
        </span>

        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-ui font-semibold">{entry.title}</span>
            {hasPhotos && (
              <>
                <ImageIcon className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
                <span className="sr-only">Zawiera zdjęcie</span>
              </>
            )}
            {badge && (
              <span className="shrink-0 rounded-sm border px-2 text-caption text-muted-foreground">
                {badge}
              </span>
            )}
          </span>
          {excerpt && (
            <span className="line-clamp-2 text-ui text-muted-foreground">
              {excerpt}
            </span>
          )}
        </span>

        {typeof mood === "number" ? (
          <span className="pt-2" title={`Nastrój: ${metricLevelLabel("mood", mood)}`}>
            <Meter size="xs" value={mood} attention={needsAttention("mood", mood)} />
            <span className="sr-only">Nastrój: {metricLevelLabel("mood", mood)}</span>
          </span>
        ) : (
          <span aria-hidden />
        )}
      </Link>
    </li>
  );
}
