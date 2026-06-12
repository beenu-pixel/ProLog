"use client";

import { usePathname } from "next/navigation";

import { ComposerInput } from "@/components/composer-input";
import { NavRow } from "@/components/bottom-nav";

/**
 * Zunifikowany dolny pasek. Łączy w jeden pływający element pole kontekstowe
 * (rozmowa z Freudem + szybki wpis) oraz — na mobile — rząd nawigacji pod nim.
 * Zastępuje dawne, osobne `ComposerBar` i `BottomNav`.
 *
 * Zachowanie wg trasy:
 * - `/welcome`, formularze (`/new`, `/…/edit`) → ukryty w całości,
 * - `/docs`, `/settings` → tylko nawigacja (bez pola i bez „+", czyli bez
 *   tworzenia wpisu); na desktopie nic (nawigacja jest w nagłówku),
 * - pozostałe → pole + (na mobile) pełna nawigacja.
 *
 * Renderujemy POJEDYNCZY `ComposerInput` (jeden stan czatu/transkrypcji);
 * o szerokości i pozycji decydują klasy responsywne, a nawigację chowamy na
 * desktopie (`lg:hidden`).
 */
export function BottomBar() {
  const pathname = usePathname();

  const isForm = pathname === "/new" || pathname.endsWith("/edit");
  if (isForm || pathname === "/welcome") return null;

  // Trasy „tylko nawigacja": brak pola i brak tworzenia wpisu.
  const navOnly = pathname === "/settings" || pathname.startsWith("/docs");

  // Tylko nawigacja (mobile): pojedyncza glass-pastylka z ikonami, bez „+".
  // Na desktopie nic (nawigacja jest w nagłówku).
  if (navOnly) {
    return (
      <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:hidden">
        <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border bg-background/85 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <NavRow allowCreate={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:bottom-6">
      <div className="w-full max-w-md lg:max-w-2xl">
        {/* Pole + nawigacja (mobile) jako jeden glass-panel; nawigacja jest
            slotem renderowanym wewnątrz panelu pod polem. */}
        <ComposerInput>
          <NavRow allowCreate />
        </ComposerInput>
      </div>
    </div>
  );
}
