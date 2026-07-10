"use client";

import { usePathname } from "next/navigation";

import { BottomTabBar } from "@/components/bottom-tab-bar";
import { ComposerInput } from "@/components/composer-input";
import { NavMenu } from "@/components/nav-menu";
import { useSession } from "@/lib/auth";
import { useTherapistEnabled } from "@/lib/therapist-prefs";

/**
 * Dolny obszar aplikacji (mobile-first): na samym dole stały pasek zakładek
 * (`BottomTabBar`, tylko mobile), nad nim pływający kompozytor. Tryb kompozytora
 * wynika z kontekstu trasy: na `/chat` to wejście czatu z Freudem, wszędzie
 * indziej — szybka notatka.
 *
 * Zachowanie wg trasy:
 * - `/welcome`, landing (`/`), formularze (`/new`, `/…/edit`) → ukryty w całości,
 * - `/docs`, `/settings` → pasek zakładek + kompaktowa pastylka z hamburgerem
 *   (mobile; wyrównana do prawej — w zasięgu kciuka; na desktopie nawigacja
 *   jest w nagłówku),
 * - `/chat` → kompozytor w trybie czatu (o ile rozmowa dostępna) + pasek,
 * - pozostałe → kompozytor w trybie notatki + pasek.
 */
export function BottomBar() {
  const pathname = usePathname();
  const session = useSession();
  const [enabledPref] = useTherapistEnabled();

  // Landing (`/`), ekran powitalny i formularze mają własny układ — bez paska.
  const isForm = pathname === "/new" || pathname.endsWith("/edit");
  if (isForm || pathname === "/welcome" || pathname === "/") return null;

  const isChat = pathname.startsWith("/chat");
  // Trasy „tylko nawigacja": bez pola/tworzenia wpisu — sam hamburger (mobile).
  const navOnly = pathname === "/settings" || pathname.startsWith("/docs");
  const chatAvailable = Boolean(session) && enabledPref;

  // Zawartość wiersza nad paskiem zakładek (kompozytor / pastylka hamburgera).
  // Na `/chat` bez dostępnej rozmowy (gość, wyłączona) stronę-gate obsługuje
  // `ChatScreen` — nad paskiem nie renderujemy nic.
  const content = navOnly ? (
    <div className="flex w-full justify-end lg:hidden">
      <div className="pointer-events-auto flex items-center rounded-full border bg-background/85 px-2 py-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <NavMenu menuOrigin="right" />
      </div>
    </div>
  ) : isChat && !chatAvailable ? null : (
    <div className="flex w-full justify-center">
      <div className="pointer-events-auto w-full max-w-md lg:max-w-2xl">
        <ComposerInput mode={isChat ? "chat" : "note"} />
      </div>
    </div>
  );

  // `pointer-events-none` na kolumnie: na desktopie pasek zakładek jest ukryty,
  // a kolumna nie może połykać kliknięć w treść pod nią. Interaktywne elementy
  // przywracają zdarzenia przez `pointer-events-auto`.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col">
      {content && (
        <div className="peer/composer flex w-full px-4 pb-3 lg:pb-6">
          {content}
        </div>
      )}
      {/* Klawiatura ekranowa: gdy pole ma fokus, chowamy pasek zakładek, żeby
          nie wjeżdżał nad klawiaturę razem z kompozytorem. */}
      <div className="peer-has-[textarea:focus]/composer:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
