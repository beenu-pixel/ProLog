import { BookOpen } from "lucide-react";

/**
 * Prawy panel widoku dziennika, gdy żaden wpis nie jest wybrany. Na mobile ten
 * ekran jest ukryty przez layout (widać samą listę); na desktopie to pusty stan
 * obok stałej listy po lewej.
 */
export default function EntriesIndexPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-accent">
        <BookOpen className="size-7 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Wybierz wpis z listy, aby zobaczyć szczegóły.
      </p>
    </div>
  );
}
