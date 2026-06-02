"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { EntryList } from "@/components/entry-list";
import { seedIfEmpty } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * Układ sekcji dziennika. Na desktopie (lg+) to dwupanelowy master-detail:
 * stała lista po lewej i szczegół/pusty stan po prawej. Na mobile pokazujemy
 * naprzemiennie jedną kolumnę — listę na /entries, a szczegół na /entries/<id>.
 */
export default function EntriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Wszystko poza samym „/entries" to widok szczegółu (lub edycji) wpisu.
  const isDetail = pathname !== "/entries";

  // Zasiewamy przykładowe wpisy raz, po stronie klienta, gdy dziennik jest pusty.
  useEffect(() => {
    seedIfEmpty();
  }, []);

  return (
    <div className="flex w-full flex-1 lg:gap-10">
      <aside
        className={cn(
          "w-full px-6 py-6 lg:w-[340px] lg:shrink-0 lg:border-r lg:py-6 lg:pl-8 lg:pr-8",
          "lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)]",
          isDetail ? "hidden lg:block" : "block"
        )}
      >
        <EntryList />
      </aside>

      <section
        className={cn(
          "min-w-0 flex-1 px-6 py-6 lg:py-8 lg:pr-10",
          isDetail ? "block" : "hidden lg:block"
        )}
      >
        {children}
      </section>
    </div>
  );
}
