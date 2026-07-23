"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { THERAPISTS } from "@/lib/therapists";
import { useActiveTherapist } from "@/lib/active-therapist";
import { selectTherapist } from "@/lib/therapist-chat-store";
import { usePlan } from "@/hooks/use-plan";

/**
 * Przełącznik aktywnej persony terapeuty w stylu selektora modelu z czatów AI
 * (np. Gemini). Dwa warianty:
 *  - `title` — tożsamość z awatarem (nagłówek panelu czatu na mobile),
 *  - `pill`  — kompaktowa pigułka „nazwa + ⌄" w pasku pola (desktop), otwierana
 *              w górę, z listą person (nazwa + rola + ptaszek przy aktywnej).
 * Lista jest wąska i wyrównana do lewej (kompaktowa, wąska kolumna na ptaszek
 * przy aktywnej pozycji). Menu zamyka klik w tło. Wybór idzie przez
 * `selectTherapist` — przełącza też wątek rozmowy (osobna historia per persona).
 */

// Długie imiona skracamy do inicjału ("Marcus Aurelius Antoninus" →
// "M. Aurelius Antoninus"); gdyby i to nie weszło, dotnie je `truncate` (…).
const MAX_FULL_NAME = 16;
function displayName(name: string): string {
  if (name.length <= MAX_FULL_NAME) return name;
  const words = name.split(" ");
  if (words.length < 2) return name;
  return `${words[0][0]}. ${words.slice(1).join(" ")}`;
}
export function TherapistSwitcher({
  variant,
  placement = "down",
  portal = false,
  className,
}: {
  variant: "title" | "pill";
  placement?: "up" | "down";
  /** Renderuj listę przez portal (fixed, liczone z triggera) — dla kontenerów z
   *  `overflow-hidden`, które inaczej przycięłyby rozwijaną listę (panel czatu). */
  portal?: boolean;
  className?: string;
}) {
  const active = useActiveTherapist();
  const plan = usePlan();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Pozycja menu w trybie portalu (fixed), liczona z triggera przy otwarciu.
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  }>({});

  // Persona zablokowana, gdy znamy plan i nie ma jej na liście dozwolonych.
  // Plan nieznany (gość/ładowanie) => nic nie blokujemy (serwer i tak egzekwuje).
  const isLocked = (id: string): boolean =>
    plan != null && !plan.allowedPersonaIds.includes(id);

  // W pigułce pokazujemy rozpoznawalny człon nazwiska (jak krótka nazwa modelu).
  const shortName = active.name.split(" ").pop() ?? active.name;
  const alignRight = variant === "pill";

  // Otwarcie/zamknięcie. W trybie portalu przy otwarciu liczymy pozycję listy z
  // prostokąta triggera (lista jest `fixed`, więc nie zależy od `overflow` rodzica).
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (portal && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: placement === "down" ? r.bottom + 4 : undefined,
        bottom: placement === "up" ? window.innerHeight - r.top + 4 : undefined,
        left: alignRight ? undefined : r.left,
        right: alignRight ? window.innerWidth - r.right : undefined,
      });
    }
    setOpen(true);
  };

  const menu = (
    <>
      <div
        className={cn("fixed inset-0", portal ? "z-[59]" : "z-40")}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <ul
        role="listbox"
        aria-label="Wybierz terapeutę"
        style={portal ? { position: "fixed", ...coords } : undefined}
        className={cn(
          "w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-popover p-1 shadow-xl",
          portal
            ? "z-[60]"
            : cn(
                "absolute z-50",
                placement === "up" ? "bottom-full mb-2" : "top-full mt-1",
                alignRight ? "right-0" : "left-0"
              )
        )}
      >
        {THERAPISTS.map((t) => {
          const isActive = t.id === active.id;
          const locked = isLocked(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setOpen(false);
                  // Persona spoza planu prowadzi do cennika zamiast wyboru.
                  if (locked) {
                    window.location.assign("/pricing");
                    return;
                  }
                  void selectTherapist(t.id);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left leading-tight transition-colors hover:bg-secondary",
                  isActive && "bg-secondary"
                )}
              >
                <span className="flex w-3.5 shrink-0 justify-center">
                  {isActive && <Check className="size-3.5 text-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {displayName(t.name)}
                    </span>
                    {locked && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground-onmuted">
                        <Lock className="size-2.5" />
                        Pro
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <div className={cn("relative", className)}>
      {variant === "title" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="-mx-2 flex flex-col rounded-xl px-2 py-1 text-left transition-colors hover:bg-secondary"
        >
          <span className="flex items-center gap-1 text-sm font-semibold">
            {displayName(active.name)}
            <ChevronDown
              className={cn(
                "size-3.5 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </span>
          <span className="text-xs text-muted-foreground">{active.title}</span>
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Terapeuta: ${active.name}`}
          title="Zmień terapeutę"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
        >
          <span className="font-medium">{shortName}</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      )}

      {open &&
        (portal && typeof document !== "undefined"
          ? createPortal(menu, document.body)
          : menu)}
    </div>
  );
}
