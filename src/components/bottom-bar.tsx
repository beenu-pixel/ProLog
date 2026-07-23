"use client";

import { useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

import { BottomTabBar } from "@/components/bottom-tab-bar";
import { ComposerInput } from "@/components/composer-input";
import { NavMenu } from "@/components/nav-menu";
import { useSession } from "@/lib/auth";
import { useTherapistEnabled } from "@/lib/therapist-prefs";
import { useLightboxOpen } from "@/lib/lightbox-store";
import { cn } from "@/lib/utils";

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
  const lightboxOpen = useLightboxOpen();

  // Wysokość całego dolnego obszaru (kompozytor + ewentualny pasek zakładek)
  // wystawiamy jako `--bottom-nav-h`, żeby menu hamburgera (portal do <body>,
  // niezależne od tego układu) mogło usiąść tuż nad polem NIEZALEŻNIE od trasy —
  // na `/chat` nie ma paska zakładek, więc pole dokuje niżej niż w dzienniku.
  // Callback-ref sprząta zmienną, gdy obszar znika (formularze, landing).
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    const root = document.documentElement;
    if (!el) {
      root.style.removeProperty("--bottom-nav-h");
      return;
    }
    const update = () =>
      root.style.setProperty("--bottom-nav-h", `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    observerRef.current = ro;
  }, []);

  // Landing (`/`), ekran powitalny i formularze mają własny układ — bez paska.
  const isForm = pathname === "/new" || pathname.endsWith("/edit");
  if (isForm || pathname === "/welcome" || pathname === "/") return null;

  // Pełnoekranowy podgląd zdjęcia przykrywa ekran — pasek nie może wisieć nad nim.
  if (lightboxOpen) return null;

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
      {/* Na `/chat` composer jest szerszy (lg:max-w-3xl), by zgrać się z szerszą
          kolumną rozmowy; w trybie notatki zostaje węższy (lg:max-w-2xl). */}
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md",
          isChat ? "lg:max-w-3xl" : "lg:max-w-2xl"
        )}
      >
        <ComposerInput mode={isChat ? "chat" : "note"} />
      </div>
    </div>
  );

  // `pointer-events-none` na kolumnie: na desktopie pasek zakładek jest ukryty,
  // a kolumna nie może połykać kliknięć w treść pod nią. Interaktywne elementy
  // przywracają zdarzenia przez `pointer-events-auto`.
  return (
    // z-50: composer musi być NAD backdropem menu (z-40), żeby tap w pole/mikrofon
    // trafiał w composer, a nie był „zjadany" na zamknięcie menu (jeden tap zamiast
    // dwóch). Panel menu (z-55) i nakładka nagrywania (z-60) są jeszcze wyżej.
    <div
      ref={measureRef}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col"
    >
      {content && (
        <div className="peer/composer flex w-full px-4 pb-3 lg:pb-6">
          {content}
        </div>
      )}
      {/* Pasek zakładek: pełnoekranowy czat (`/chat`) go NIE pokazuje — to ekran
          „w głąb", a migoczący pasek byłby chrome nie na miejscu (wyjście jest w
          nagłówku czatu). Na pozostałych trasach chowa się, gdy kompozytor jest
          „aktywny": pole ma fokus (klawiatura) LUB trwa nagrywanie/transkrypcja
          (`data-voice`) — żeby nawigacja nie wskakiwała w środku interakcji. */}
      {!isChat && (
        <div className="peer-has-[textarea:focus]/composer:hidden peer-has-[[data-voice]]/composer:hidden">
          <BottomTabBar />
        </div>
      )}
    </div>
  );
}
