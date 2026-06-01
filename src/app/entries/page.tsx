"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EntryCard } from "@/components/entry-card";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";

export default function EntriesPage() {
  const entries = useEntries();
  const ready = useHydrated();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Wpisy</h1>

      {!ready ? null : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">
            Nie masz jeszcze żadnych wpisów.
          </p>
          <Button asChild className="mt-4">
            <Link href="/new">Dodaj pierwszy wpis</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
