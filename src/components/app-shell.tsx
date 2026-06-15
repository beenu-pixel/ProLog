"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BottomBar } from "@/components/bottom-bar";
import { useAnimationsEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Powłoka aplikacji (nagłówek + treść + pływające paski). Na desktopie blokujemy
 * wysokość do ekranu i chowamy przewijanie strony TYLKO w dzienniku (`/entries`),
 * gdzie obowiązuje dwupanelowy master-detail z własnym przewijaniem paneli. Na
 * pozostałych trasach (Ustawienia, Statystyki, …) zostawiamy normalny scroll
 * strony, bo ich treść może być wyższa niż ekran.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Trasy z dwupanelowym/„pełnoekranowym" układem, które przewijają się WEWNĄTRZ
  // (własnym animowanym paskiem), a nie scrollem strony: dziennik oraz Ustawienia
  // i Statystyki (tam treść opakowana w <PageScroll>).
  const locked =
    pathname.startsWith("/entries") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/stats");

  // Landing (`/`) ma własny pełny układ (nagłówek + stopkę) i nie korzysta z
  // pływającego dolnego paska — nie rezerwujemy więc dołu na pasek.
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
        "flex min-h-dvh flex-col",
        locked && "lg:h-dvh lg:overflow-hidden"
      )}
    >
      <AppHeader />
      {/* Mobile: dół rezerwuje miejsce na pojedynczy pływający pasek
          (kompozytor / hamburger) — stąd pb-28.
          Desktop: na zablokowanych trasach treść przewija się WEWNĄTRZ i ma
          wypełniać cały ekran (także pod pływającym kompozytorem z efektem
          glass), więc NIE rezerwujemy tu dołu (lg:pb-0) — prześwit pod pasek
          dodają same sekcje w przewijanej treści. Trasy bez własnego
          przewijania trzymają klasyczny odstęp lg:pb-28. */}
      <main
        className={cn(
          "flex w-full flex-1 flex-col",
          bare ? "pb-0" : "pb-28",
          locked ? "lg:min-h-0 lg:overflow-hidden lg:pb-0" : !bare && "lg:pb-28"
        )}
      >
        {children}
      </main>
      <BottomBar />
    </div>
  );
}
