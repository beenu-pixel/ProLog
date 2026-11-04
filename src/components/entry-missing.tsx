"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LoadingText } from "@/components/ui/loading-dots";
import { useEntriesSyncing } from "@/lib/auth";

/**
 * Wpisu nie ma lokalnie: albo jeszcze dojeżdża z chmury, albo naprawdę nie istnieje.
 * Na środku wolnego miejsca między nagłówkiem a dolnym paskiem (`pb-40` powłoki).
 */
export function EntryMissing() {
  const syncing = useEntriesSyncing();

  return (
    <div className="flex min-h-[calc(100dvh-13rem)] flex-col items-center justify-center gap-4 text-center lg:min-h-[60vh]">
      {syncing ? (
        <LoadingText>Wczytuję wpis</LoadingText>
      ) : (
        <>
          <p className="text-muted-foreground">Nie znaleziono wpisu.</p>
          <Button asChild variant="outline">
            <Link href="/entries">Wróć do listy</Link>
          </Button>
        </>
      )}
    </div>
  );
}
