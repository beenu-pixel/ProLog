"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { THERAPISTS } from "@/lib/therapists";
import { useActiveTherapist } from "@/lib/active-therapist";
import { selectTherapist } from "@/lib/therapist-chat-store";

/**
 * Przełącznik aktywnej persony terapeuty w stylu selektora modelu z czatów AI
 * (np. Gemini). Dwa warianty:
 *  - `title` — tożsamość z awatarem (nagłówek panelu czatu na mobile),
 *  - `pill`  — kompaktowa pigułka „nazwa + ⌄" w pasku pola (desktop), otwierana
 *              w górę, z listą person (nazwa + rola + ptaszek przy aktywnej).
 * Menu zamyka klik w tło (overlay). Wybór idzie przez `selectTherapist` —
 * przełącza też wątek rozmowy (osobna historia per persona).
 */
export function TherapistSwitcher({
  variant,
  placement = "down",
  className,
}: {
  variant: "title" | "pill";
  placement?: "up" | "down";
  className?: string;
}) {
  const active = useActiveTherapist();
  const [open, setOpen] = useState(false);

  // W pigułce pokazujemy rozpoznawalny człon nazwiska (jak krótka nazwa modelu).
  const shortName = active.name.split(" ").pop() ?? active.name;
  const alignRight = variant === "pill";

  return (
    <div className={cn("relative", className)}>
      {variant === "title" ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="-mx-2 flex flex-col rounded-xl px-2 py-1 text-left transition-colors hover:bg-secondary"
        >
          <span className="flex items-center gap-1 text-sm font-semibold">
            {active.name}
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
          type="button"
          onClick={() => setOpen((v) => !v)}
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

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <ul
            role="listbox"
            aria-label="Wybierz terapeutę"
            className={cn(
              "absolute z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-popover p-1 shadow-xl",
              placement === "up" ? "bottom-full mb-2" : "top-full mt-1",
              alignRight ? "right-0" : "left-0"
            )}
          >
            {THERAPISTS.map((t) => {
              const isActive = t.id === active.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setOpen(false);
                      void selectTherapist(t.id);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-secondary",
                      isActive && "bg-secondary"
                    )}
                  >
                    <span className="flex w-4 shrink-0 justify-center pt-0.5">
                      {isActive && <Check className="size-4 text-primary" />}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium">
                        {t.name}
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
      )}
    </div>
  );
}
