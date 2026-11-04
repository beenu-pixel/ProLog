"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BottomBar } from "@/components/bottom-bar";
import { SyncNotice } from "@/components/sync-notice";
import { WindowScroll } from "@/components/window-scroll";
import { useAnimationsEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Powłoka aplikacji. Jedna nawigacja na ekran: na telefonie dolny pasek
 * (`BottomBar`), na komputerze pasek boczny (`AppSidebar`). Bez górnego paska —
 * każdy ekran ma własny tytuł, więc nic nie wisi nad treścią.
 *
 * Na komputerze blokujemy wysokość do ekranu i chowamy przewijanie strony na
 * trasach, które przewijają się WEWNĄTRZ (dziennik z listą i czytnikiem, a także
 * Ustawienia i Statystyki opakowane w <PageScroll>). Pozostałe trasy przewija
 * okno.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locked =
    pathname.startsWith("/entries") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/stats");

  // Landing (`/`) ma własny pełny układ (nagłówek + stopkę) — bez dolnego paska.
  const bare = pathname === "/";

  // Globalny wyłącznik animacji: klasa na <html> (obejmuje też portale, np. menu
  // renderowane do <body>). CSS w globals.css zeruje wtedy animacje/przejścia.
  const [animationsEnabled] = useAnimationsEnabled();
  useEffect(() => {
    document.documentElement.classList.toggle("no-anim", !animationsEnabled);
  }, [animationsEnabled]);

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col lg:flex-row",
        locked && "lg:h-dvh lg:overflow-hidden"
      )}
    >
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
        {!bare && <SyncNotice />}
        {/* Dół rezerwuje dokładnie tyle, ile zajmuje dolny obszar (zmierzone w
            BottomBar jako --bottom-nav-h, razem z safe-area) + 1rem oddechu,
            żeby koniec treści dało się przewinąć nad niego. Na komputerze dolny
            obszar istnieje tylko w rozmowie (pole pisania), więc bez niego
            rezerwa wynosi zero. */}
        <main
          className={cn(
            "flex w-full flex-1 flex-col",
            bare
              ? "pb-0"
              : "pb-[calc(var(--bottom-nav-h,9rem)+1rem)] lg:pb-[calc(var(--bottom-nav-h,0rem)+1rem)]",
            locked && "lg:min-h-0 lg:overflow-hidden lg:pb-0"
          )}
        >
          {children}
        </main>
      </div>
      <BottomBar />
      {/* Trasy przewijane oknem (np. /docs) dostają ten sam animowany pasek co
          panele z własnym scrollem — zamiast natywnego paska przeglądarki. */}
      {!locked && !bare && <WindowScroll />}
    </div>
  );
}
