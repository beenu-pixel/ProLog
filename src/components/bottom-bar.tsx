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
 * Dolny obszar aplikacji. Telefon: na samym dole stały pasek zakładek
 * (`BottomTabBar`), nad nim pole pisania; tryb pola wynika z trasy — na `/chat`
 * to wejście rozmowy, wszędzie indziej szybka notatka. Komputer: tylko pole
 * rozmowy na `/chat` (nawigację ma pasek boczny, a notatkę Dziennika — kolumna
 * listy), zadokowane pod kolumną rozmowy.
 *
 * Zachowanie wg trasy:
 * - `/welcome`, landing (`/`), formularze (`/new`, `/…/edit`) → ukryty w całości,
 * - `/docs`, `/settings` → sam pasek zakładek (telefon),
 * - `/chat` → pole w trybie rozmowy (o ile rozmowa dostępna), bez zakładek,
 * - pozostałe → pole w trybie notatki + pasek (telefon).
 *
 * Cały obszar ma pełne tło i przejmuje dotyk: treść strony kończy się na jego
 * górnej krawędzi (rezerwa w `AppShell`), zamiast przepływać pod polem.
 */
export function BottomBar() {
  const pathname = usePathname();
  const session = useSession();
  const [enabledPref] = useTherapistEnabled();
  const lightboxOpen = useLightboxOpen();
  const { open: menuOpen } = useNavMenu();

  // Wysokość całego dolnego obszaru wystawiamy jako `--bottom-nav-h`, żeby menu
  // „Więcej” (portal do <body>) mogło usiąść tuż nad nim NIEZALEŻNIE od trasy.
  // Z tej samej zmiennej `AppShell` rezerwuje miejsce pod treścią, a
  // `scroll-padding-bottom` sprawia, że przewinięcie do elementu (koniec rozmowy,
  // fokus z klawiatury) zatrzymuje go NAD tym obszarem, nie pod nim. Na komputerze
  // poza rozmową obszar jest pusty, więc zmierzona wysokość to 0.
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
  // Trasy „tylko nawigacja": bez pola/tworzenia wpisu.
  const navOnly = pathname === "/settings" || pathname.startsWith("/docs");
  const chatAvailable = Boolean(session) && enabledPref;

  // Pole nad paskiem zakładek. Trasy „tylko nawigacja” go nie mają, a na `/chat`
  // bez dostępnej rozmowy (gość, wyłączona) stronę-bramkę obsługuje `ChatScreen`.
  const showComposer = !(navOnly || (isChat && !chatAvailable));

  return (
    // z-50: pole musi być NAD tłem menu (z-40), żeby tap w pole/mikrofon trafiał
    // w pole, a nie był „zjadany” na zamknięcie menu. Panel menu (z-55) i nakładka
    // nagrywania (z-60) są jeszcze wyżej. Na komputerze obszar zaczyna się za
    // paskiem bocznym (lg:left-56).
    <div
      ref={measureRef}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background max-lg:border-t lg:left-56",
        !menuOpen && "pointer-events-auto"
      )}
    >
      {showComposer && (
        <div
          className={cn(
            "peer/composer flex w-full justify-center px-4 pt-3 pb-3",
            // Komputer: pole tylko w rozmowie, zadokowane pod jej kolumną.
            isChat ? "lg:px-8 lg:pt-2 lg:pb-6" : "lg:hidden"
          )}
        >
          <div
            className={cn(
              "pointer-events-auto w-full max-w-md",
              isChat && "lg:max-w-3xl"
            )}
          >
            <ComposerInput mode={isChat ? "chat" : "note"} />
          </div>
        </div>
      )}
      {/* Pasek zakładek: pełnoekranowa rozmowa (`/chat`) go NIE pokazuje — to
          ekran „w głąb” (wyjście jest w nagłówku rozmowy). Na pozostałych trasach
          chowa się, gdy pole jest „aktywne”: ma fokus (klawiatura) LUB trwa
          nagrywanie/przepisywanie (`data-voice`) — żeby podczas pisania nic nie
          wisiało nad tekstem i nawigacja nie wskakiwała w środku interakcji. */}
      {!isChat && (
        <div className="peer-has-[textarea:focus]/composer:hidden peer-has-[[data-voice]]/composer:hidden">
          <BottomTabBar />
        </div>
      )}
    </div>
  );
}
