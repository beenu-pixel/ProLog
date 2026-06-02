"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, NotebookText } from "lucide-react";

import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  // Na ekranach formularza (nowy / edycja wpisu) chowamy nawigację, żeby nie
  // zasłaniała treści — powrót realizuje strzałka i „Anuluj" w samym formularzu.
  const isForm = pathname === "/new" || pathname.endsWith("/edit");
  if (isForm) return null;

  // Zakładka „Wpisy" jest aktywna na liście oraz na ekranach szczegółu/edycji wpisu.
  const entriesActive = pathname === "/" || pathname.startsWith("/entries");

  return (
    <nav className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:hidden">
      {/* Pływająca „wyspa" nawigacji. */}
      <div className="relative h-16 w-full max-w-md rounded-full border bg-background/85 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70">
        {/* Dodawanie wpisu — na środku paska. */}
        <Link
          href="/new"
          aria-label="Dodaj wpis"
          className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="size-6" />
        </Link>

        {/* Lista wpisów — wyśrodkowana w prawej połowie (między „+" a prawą krawędzią). */}
        <Link
          href="/entries"
          aria-label="Wpisy"
          className={cn(
            "absolute left-3/4 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors",
            entriesActive
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <NotebookText
            className="size-6"
            strokeWidth={entriesActive ? 2.4 : 1.8}
          />
        </Link>
      </div>
    </nav>
  );
}
