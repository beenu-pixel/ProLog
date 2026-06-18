"use client";

import { useEffect, useRef } from "react";
import { Image as ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { dayKey, formatWeekdayShort } from "@/lib/format";
import { isToday } from "@/lib/stats";
import type { Entry } from "@/lib/types";

interface DayStripProps {
  /** Dni od najstarszego do najnowszego (ostatni = dziś). */
  days: Date[];
  /** Klucz „YYYY-MM-DD" zaznaczonego dnia. */
  selectedKey: string;
  entriesByDay: Map<string, Entry[]>;
  onSelect: (date: Date) => void;
}

/**
 * Poziomy, przewijalny pasek dni (inspiracja: Imperfect). Każdy kafelek to skrót
 * dnia tygodnia, duża liczba dnia i kropka, gdy w tym dniu są wpisy. Zaznaczony
 * dzień ma samo szare tło; po zmianie zaznaczenia kafelek wjeżdża do widoku.
 *
 * Przewijanie myszką: kółko (pionowy delta → poziom) oraz „chwyć i przeciągnij"
 * (wciśnięcie + ruch), tak jak palcem na telefonie. Dotyk korzysta z natywnego
 * przewijania.
 */
export function DayStrip({
  days,
  selectedKey,
  entriesByDay,
  onSelect,
}: DayStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  // Zaznaczony dzień (domyślnie dziś = skraj prawy) zawsze widoczny.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selectedKey]);

  // Kółko myszy przewija pasek w poziomie (delta pionowa → przesunięcie poziome).
  // Natywny listener z `passive: false`, by `preventDefault` faktycznie działał.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return; // dotyk ma natywne przewijanie
    const el = scrollRef.current;
    if (!el) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - d.startX;
    // Dopiero realny ruch uznajemy za przeciąganie (przechwytujemy wskaźnik, by
    // ruch nie gubił się poza paskiem) — zwykłe kliknięcie zostaje kliknięciem.
    if (!d.moved && Math.abs(dx) > 3) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    if (d.moved) el.scrollLeft = d.startScroll - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const el = scrollRef.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };

  // Po przeciągnięciu pomijamy kliknięcie, żeby drag nie zmieniał wybranego dnia.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      drag.current.moved = false;
    }
  };

  return (
    // Okno przewijania ograniczone do DOKŁADNIE 7 kafelków (7×w-14 + 6×gap-2.5
    // ≈ 28.75rem) i wyśrodkowane. `max-width` z natury przycina szersze ekrany
    // (tablet w pionie i poziomie pokaże 7), a na węższym telefonie pasek jest
    // pełnej szerokości i mieści mniej — resztę odsłania wtedy przewijanie.
    // Bez paddingu w poziomie na treści, by liczba widocznych kafelków była
    // spójna niezależnie od pozycji przewijania (padding zaniżał/zawyżał liczbę).
    <div
      ref={scrollRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      className="hide-native-scroll mx-auto w-full max-w-[28.75rem] cursor-grab select-none overflow-x-auto active:cursor-grabbing"
    >
      <div className="flex w-max gap-2.5 px-1">
        {days.map((date) => {
          const key = dayKey(date);
          const dayEntries = entriesByDay.get(key) ?? [];
          const has = dayEntries.length > 0;
          const hasPhotos = dayEntries.some((e) => (e.photos?.length ?? 0) > 0);
          const selected = key === selectedKey;
          const today = isToday(date);

          return (
            <button
              key={key}
              ref={selected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(date)}
              aria-current={selected ? "date" : undefined}
              aria-label={
                date.toLocaleDateString("pl-PL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }) + (hasPhotos ? ", ze zdjęciem" : "")
              }
              className={cn(
                "flex w-14 shrink-0 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 transition-colors",
                selected ? "bg-accent" : "hover:bg-accent/60"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  selected ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {formatWeekdayShort(date).replace(".", "")}
              </span>
              <span className="text-xl font-bold leading-none tabular-nums">
                {date.getDate()}
              </span>
              {/* Stała wysokość znacznika (mieści ikonę), by liczby były wyrównane
                  w rzędzie. Dzień ze zdjęciem → ikona (implikuje wpis); sam wpis →
                  kropka; brak wpisów → pusto. */}
              <span className="flex h-3 items-center">
                {hasPhotos ? (
                  <ImageIcon
                    className={cn(
                      "size-3",
                      selected ? "text-foreground" : "text-muted-foreground"
                    )}
                    aria-hidden
                  />
                ) : has ? (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      selected ? "bg-foreground" : "bg-muted-foreground"
                    )}
                    aria-hidden
                  />
                ) : null}
              </span>
              {today && (
                <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  dziś
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
