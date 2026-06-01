import Link from "next/link";

import { Card } from "@/components/ui/card";
import { MoodDots } from "@/components/mood-dots";
import { formatDate, toExcerpt } from "@/lib/format";
import type { Entry } from "@/lib/types";

export function EntryCard({ entry }: { entry: Entry }) {
  const excerpt = toExcerpt(entry.content);

  return (
    <Link href={`/entries/${entry.id}`} className="block">
      <Card className="gap-3 py-5 transition-colors hover:bg-accent/50">
        <div className="flex items-start justify-between gap-4 px-6">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">
              {formatDate(entry.createdAt)}
            </p>
            <h2 className="truncate text-base font-semibold">
              {entry.title}
            </h2>
          </div>
          <MoodDots value={entry.mood} size="sm" className="mt-1 shrink-0" />
        </div>
        {excerpt && (
          <p className="line-clamp-2 px-6 text-sm text-muted-foreground">
            {excerpt}
          </p>
        )}
      </Card>
    </Link>
  );
}
