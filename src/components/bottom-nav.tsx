"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, NotebookText, BarChart3, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sound";

/**
 * Rząd nawigacji dolnego paska (mobile): Wpisy / Statystyki / [+] / Ustawienia.
 * Czysto prezentacyjny — o tym, kiedy się pokazuje, decyduje `BottomBar`.
 *
 * `allowCreate` steruje wyróżnionym przyciskiem „+" (nowy wpis). Na ekranach,
 * gdzie tworzenie wpisu jest wyłączone (np. /docs, /settings), przekazujemy
 * `false` i pokazujemy tylko trzy zakładki.
 */
export function NavRow({ allowCreate = true }: { allowCreate?: boolean }) {
  const pathname = usePathname();

  const entriesActive = pathname === "/" || pathname.startsWith("/entries");
  const statsActive = pathname.startsWith("/stats");
  const settingsActive = pathname.startsWith("/settings");

  const tab = (active: boolean) =>
    cn(
      "flex size-11 items-center justify-center rounded-full transition-colors",
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="flex h-16 w-full items-center justify-around px-2">
      <Link href="/entries" aria-label="Wpisy" className={tab(entriesActive)}>
        <NotebookText className="size-6" strokeWidth={entriesActive ? 2.4 : 1.8} />
      </Link>

      <Link href="/stats" aria-label="Statystyki" className={tab(statsActive)}>
        <BarChart3 className="size-6" strokeWidth={statsActive ? 2.4 : 1.8} />
      </Link>

      {/* Dodawanie wpisu — wyróżniony przycisk; ukryty tam, gdzie tworzenie
          wpisu jest wyłączone. */}
      {allowCreate && (
        <Link
          href="/new"
          aria-label="Dodaj wpis"
          onClick={() => playSound("entry-new")}
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="size-6" />
        </Link>
      )}

      <Link href="/settings" aria-label="Ustawienia" className={tab(settingsActive)}>
        <Settings className="size-6" strokeWidth={settingsActive ? 2.4 : 1.8} />
      </Link>
    </div>
  );
}
