"use client";

import { useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

import { BottomTabBar } from "@/components/bottom-tab-bar";
import { ComposerInput } from "@/components/composer-input";
import { useSession } from "@/lib/auth";
import { useTherapistEnabled } from "@/lib/therapist-prefs";
import { useLightboxOpen } from "@/lib/lightbox-store";
import { useNavMenu } from "@/lib/nav-menu-store";
import { cn } from "@/lib/utils";

/**
 * Dolny obszar aplikacji (mobile-first): na samym dole stały pasek zakładek
 * (`BottomTabBar`, tylko mobile), nad nim pływający kompozytor. Tryb kompozytora
 * wynika z kontekstu trasy: na `/chat` to wejście czatu z Freudem, wszędzie
 * indziej — szybka notatka.
 *
 * Zachowanie wg trasy:
 * - `/welcome`, landing (`/`), formularze (`/new`, `/…/edit`) → ukryty w całości,
 * - `/docs`, `/settings` → sam pasek zakładek (mobile; na desktopie nawigacja jest
 *   w nagłówku),
 * - `/chat` → kompozytor w trybie czatu (o ile rozmowa dostępna) + pasek,
 * - pozostałe → kompozytor w trybie notatki + pasek.
 *
 * Na mobile cały obszar ma pełne tło i przejmuje dotyk: treść strony kończy się na
 * jego górnej krawędzi, zamiast przepływać pod polem lub przyciskiem, a chowający
 * się pod nim element nie złapie przypadkowego tapnięcia.
 */
export function BottomBar() {
  const pathname = usePathname();
  const session = useSession();
  const [enabledPref] = useTherapistEnabled();
  const lightboxOpen = useLightboxOpen();
  const { open: menuOpen } = useNavMenu();

  // Wysokość całego dolnego obszaru (kompozytor + ewentualny pasek zakładek)
  // wystawiamy jako `--bottom-nav-h`, żeby menu hamburgera (portal do <body>,
  // niezależne od tego układu) mogło usiąść tuż nad polem NIEZALEŻNIE od trasy —
  // na `/chat` nie ma paska zakładek, więc pole dokuje niżej niż w dzienniku.
  // Z tej samej zmiennej `AppShell` rezerwuje miejsce pod treścią, a
  // `scroll-padding-bottom` sprawia, że przewinięcie do elementu (koniec rozmowy
  // na `/chat`, fokus z klawiatury) zatrzymuje go NAD tym obszarem, nie pod nim.
  // Callback-ref sprząta oba, gdy obszar znika (formularze, landing).
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    const root = document.documentElement;
    if (!el) {
      root.style.removeProperty("--bottom-nav-h");
      root.style.removeProperty("scroll-padding-bottom");
      return;
    }
    const update = () => {
      const height = `${el.offsetHeight}px`;
      root.style.setProperty("--bottom-nav-h", height);
      root.style.setProperty("scroll-padding-bottom", height);
    };
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

  // Zawartość wiersza nad paskiem zakładek (kompozytor). Trasy „tylko nawigacja"
  // nie mają tego wiersza, a na `/chat` bez dostępnej rozmowy (gość, wyłączona)
  // stronę-gate obsługuje `ChatScreen` — nad paskiem nie renderujemy nic.
  const content = navOnly || (isChat && !chatAvailable) ? null : (
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
  // przywracają zdarzenia przez `pointer-events-auto`. Na mobile kolumna ma pełne
  // tło, więc sama przejmuje dotyk — poza otwartym menu, gdzie tap w puste miejsce
  // ma dojść do backdropu i je zamknąć.
  return (
    // z-50: composer musi być NAD backdropem menu (z-40), żeby tap w pole/mikrofon
    // trafiał w composer, a nie był „zjadany" na zamknięcie menu (jeden tap zamiast
    // dwóch). Panel menu (z-55) i nakładka nagrywania (z-60) są jeszcze wyżej.
    <div
      ref={measureRef}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col max-lg:bg-background",
        !menuOpen && "max-lg:pointer-events-auto"
      )}
    >
      {content && (
        <div className="peer/composer flex w-full px-4 py-3 lg:pt-0 lg:pb-6">
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
