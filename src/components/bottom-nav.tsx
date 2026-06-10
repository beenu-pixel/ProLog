"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, NotebookText, BarChart3, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sound";

export function BottomNav() {
  const pathname = usePathname();

  // Na ekranach formularza (nowy / edycja wpisu) chowamy nawigację, żeby nie
  // zasłaniała treści — powrót realizuje strzałka w kreatorze/formularzu.
  const isForm = pathname === "/new" || pathname.endsWith("/edit");
  if (isForm || pathname === "/welcome") return null;

  const entriesActive = pathname === "/" || pathname.startsWith("/entries");
  const statsActive = pathname.startsWith("/stats");
  const settingsActive = pathname.startsWith("/settings");

  const tab = (active: boolean) =>
    cn(
      "flex size-11 items-center justify-center rounded-full transition-colors",
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:hidden">
      <div className="flex h-16 w-full max-w-md items-center justify-around rounded-full border bg-background/85 px-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <Link href="/entries" aria-label="Wpisy" className={tab(entriesActive)}>
          <NotebookText
            className="size-6"
            strokeWidth={entriesActive ? 2.4 : 1.8}
          />
        </Link>

        <Link href="/stats" aria-label="Statystyki" className={tab(statsActive)}>
          <BarChart3 className="size-6" strokeWidth={statsActive ? 2.4 : 1.8} />
        </Link>

        {/* Dodawanie wpisu — wyróżniony przycisk. */}
        <Link
          href="/new"
          aria-label="Dodaj wpis"
          onClick={() => playSound("entry-new")}
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="size-6" />
        </Link>

        <Link
          href="/settings"
          aria-label="Ustawienia"
          className={tab(settingsActive)}
        >
          <Settings className="size-6" strokeWidth={settingsActive ? 2.4 : 1.8} />
        </Link>
      </div>
    </nav>
  );
}
