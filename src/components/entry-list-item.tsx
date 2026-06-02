import Link from "next/link";

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
}: {
  entry: Entry;
  active?: boolean;
}) {
  const excerpt = toExcerpt(entry.content, 90);

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
          <p className="text-xs font-semibold uppercase tracking-wide">
            {formatWeekday(entry.createdAt)}
          </p>
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
