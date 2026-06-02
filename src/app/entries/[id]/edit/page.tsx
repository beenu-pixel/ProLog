"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EntryForm } from "@/components/entry-form";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";

export default function EditEntryPage() {
  const params = useParams<{ id: string }>();
  const entries = useEntries();
  const ready = useHydrated();
  const entry = entries.find((e) => e.id === params.id);

  if (!ready) return null;

  if (!entry) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 text-center">
        <p className="text-muted-foreground">Nie znaleziono wpisu.</p>
        <Button asChild variant="outline">
          <Link href="/entries">Wróć do listy</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Edycja wpisu</h1>
        <Button asChild variant="ghost" size="icon" aria-label="Wróć">
          <Link href={`/entries/${entry.id}`}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
      </div>
      <EntryForm entry={entry} />
    </div>
  );
}
