import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatDayNumber,
  formatMonthYear,
  formatWeekday,
  toExcerpt,
} from "@/lib/format";
import type { Entry } from "@/lib/types";

/**
 * Pozycja listy w stylu Stoic: duża liczba dnia miesiąca po lewej, obok mała
 * data (dzień tygodnia + miesiąc/rok) i początek notatki. Nastrój pojawia się
 * dopiero w widoku szczegółu wpisu.
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

  return (
    <li>
      <Link
        href={`/entries/${entry.id}`}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex gap-4 rounded-xl px-3 py-4 transition-colors",
          active ? "bg-accent" : "hover:bg-accent/60"
        )}
      >
        <span className="w-12 shrink-0 text-right text-4xl font-bold leading-none tracking-tight tabular-nums">
          {formatDayNumber(entry.createdAt)}
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide">
              {formatWeekday(entry.createdAt)}
            </p>
            {hasPhotos && (
              <>
                <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">Zawiera zdjęcie</span>
              </>
            )}
            {badge && (
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMonthYear(entry.createdAt)}
          </p>
          {excerpt && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {excerpt}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
