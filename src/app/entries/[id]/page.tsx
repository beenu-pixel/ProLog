"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoodDots, MOOD_LABELS } from "@/components/mood-dots";
import { deleteEntry } from "@/lib/storage";
import { useEntries } from "@/hooks/use-entries";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatDate } from "@/lib/format";

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const entries = useEntries();
  const ready = useHydrated();
  const entry = entries.find((e) => e.id === params.id);

  const handleDelete = () => {
    deleteEntry(params.id);
    router.push("/entries");
  };

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
    <article className="w-full max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {formatDate(entry.createdAt)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {entry.title}
          </h1>
          <div className="flex items-center gap-2">
            <MoodDots value={entry.mood} size="sm" />
            <span className="text-xs text-muted-foreground">
              {MOOD_LABELS[entry.mood]}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Wróć do listy"
          onClick={() => router.push("/entries")}
          className="lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </Button>
      </div>

      {entry.content ? (
        <div
          className="prose-content text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: entry.content }}
        />
      ) : (
        <p className="text-sm text-muted-foreground italic">Brak treści.</p>
      )}

      <div className="flex justify-end gap-3 border-t pt-6">
        <Button asChild variant="outline">
          <Link href={`/entries/${entry.id}/edit`}>
            <Pencil className="size-4" />
            Edytuj
          </Link>
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" />
              Usuń
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usunąć ten wpis?</DialogTitle>
              <DialogDescription>
                Tej operacji nie można cofnąć. Wpis zostanie trwale usunięty.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Anuluj</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDelete}>
                Usuń
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </article>
  );
}
