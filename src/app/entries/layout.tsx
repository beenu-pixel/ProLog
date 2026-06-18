"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { EntryList } from "@/components/entry-list";
import { MobileDayView } from "@/components/mobile-day-view";
import { seedIfEmpty } from "@/lib/storage";
import {
  SIDEBAR_DEFAULT,
  clampSidebarWidth,
  readSidebarWidth,
  writeSidebarWidth,
} from "@/lib/sidebar-width";
import { cn } from "@/lib/utils";

/**
 * Układ sekcji dziennika. Na desktopie (lg+) to dwupanelowy master-detail:
 * lista po lewej (o regulowanej szerokości — uchwyt na prawej krawędzi) i
 * szczegół/pusty stan po prawej. Na mobile pokazujemy naprzemiennie jedną
 * kolumnę — listę na /entries, a szczegół na /entries/<id>.
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

  // Szerokość panelu sterowana lokalnym stanem; localStorage tylko utrwala.
  // Startujemy od domyślnej (zgodnie z SSR), a zapisaną wczytujemy po montażu —
  // bez niezgodności hydratacji. Podczas przeciągania pokazujemy `dragWidth`.
  const [width, setWidth] = useState(SIDEBAR_DEFAULT);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const effectiveWidth = dragWidth ?? width;

  useEffect(() => {
    const saved = readSidebarWidth();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jednorazowe wczytanie z localStorage (niedostępnego w SSR)
    if (saved !== SIDEBAR_DEFAULT) setWidth(saved);
  }, []);

  const dragging = useRef(false);
  const start = useRef({ x: 0, w: SIDEBAR_DEFAULT });
  // Najświeższa szerokość z trwającego przeciągania — by przy puszczeniu zapisać
  // ją poza updaterem stanu (updater musi być czysty, bez efektów ubocznych).
  const liveWidth = useRef<number>(SIDEBAR_DEFAULT);

  const beginDrag = (clientX: number) => {
    dragging.current = true;
    start.current = { x: clientX, w: effectiveWidth };
    liveWidth.current = effectiveWidth;
    setDragWidth(effectiveWidth);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const next = clampSidebarWidth(start.current.w + (e.clientX - start.current.x));
      liveWidth.current = next;
      setDragWidth(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Utrwalamy końcową szerokość, ustawiamy ją jako bazową i zdejmujemy
      // `dragWidth` — wszystko w jednym batchu, bez „mrugania" do starej wartości.
      setWidth(liveWidth.current);
      setDragWidth(null);
      writeSidebarWidth(liveWidth.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div className="flex w-full flex-1 lg:min-h-0 lg:gap-10">
      {/* Desktop: regulowana lista (master). Na mobile listę zastępuje widok dnia. */}
      <aside
        style={{ width: effectiveWidth }}
        className={cn(
          "relative hidden lg:block lg:shrink-0 lg:border-r lg:pt-6 lg:pl-8 lg:pr-8",
          "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]",
          dragWidth === null && "lg:transition-[width] lg:duration-200"
        )}
      >
        <EntryList />

        {/* Uchwyt do zmiany szerokości — straddluje prawą krawędź panelu.
            Przeciąganie = regulacja, dwuklik = powrót do domyślnej szerokości. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Zmień szerokość listy (dwuklik przywraca domyślną)"
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            beginDrag(e.clientX);
          }}
          onDoubleClick={() => {
            setDragWidth(null);
            setWidth(SIDEBAR_DEFAULT);
            writeSidebarWidth(SIDEBAR_DEFAULT);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const next = clampSidebarWidth(
              effectiveWidth + (e.key === "ArrowLeft" ? -16 : 16)
            );
            setWidth(next);
            writeSidebarWidth(next);
          }}
          className="group absolute inset-y-0 right-0 z-20 hidden w-3 translate-x-1/2 cursor-col-resize touch-none lg:block"
        >
          <span
            className={cn(
              "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors",
              dragWidth !== null
                ? "bg-foreground/40"
                : "bg-transparent group-hover:bg-foreground/20 group-focus-visible:bg-foreground/30"
            )}
          />
        </div>
      </aside>

      {/* Mobile: widok dnia (pasek dni + treść) na bazowej trasie /entries. */}
      {!isDetail && (
        <div className="flex w-full flex-1 flex-col px-6 py-6 lg:hidden">
          <MobileDayView />
        </div>
      )}

      <section
        className={cn(
          "min-w-0 flex-1 px-6 py-6 lg:min-h-0 lg:overflow-y-auto lg:pt-8 lg:pb-28 lg:pr-10",
          isDetail ? "block" : "hidden lg:block"
        )}
      >
        {children}
      </section>
    </div>
  );
}
