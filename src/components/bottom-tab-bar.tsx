"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, NotebookText, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";
import { useTherapistEnabled } from "@/lib/therapist-prefs";
import { setDraft, textToHtml } from "@/lib/entry-draft";
import { getComposerText, clearComposerText } from "@/lib/composer-text";
import { playSound } from "@/lib/sound";

/**
 * Stały dolny pasek zakładek (tylko mobile) — trzy najczęstsze cele jednym
 * tapnięciem: Dziennik, Nowy wpis, Rozmowa (czat z aktywną personą terapeuty —
 * etykieta celowo bez imienia, bo person jest kilka). Dokowany do samej krawędzi ekranu
 * (safe-area), kompozytor pływa NAD nim. Rzadsze sekcje (Statystyki,
 * Ustawienia, Dokumentacja) zostają w menu pod hamburgerem (`NavMenu`).
 *
 * „Nowy wpis" to akcja, nie sekcja — stąd wyróżnienie ikony wypełnionym
 * kółkiem (wzorzec „compose"). Tapnięcie zabiera ewentualny tekst z kompozytora
 * jako wersję roboczą (nie gubimy pracy użytkownika). Zakładka Freud jest
 * widoczna tylko dla zalogowanych z włączoną rozmową (jak reszta UI AI).
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const session = useSession();
  const [enabledPref] = useTherapistEnabled();
  const showFreud = Boolean(session) && enabledPref;

  const entriesActive = pathname === "/" || pathname.startsWith("/entries");
  const chatActive = pathname.startsWith("/chat");

  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-xs leading-none transition-colors",
      active
        ? "font-medium text-foreground"
        : "text-muted-foreground hover:text-foreground"
    );

  // Tekst z pola zabieramy jako wersję roboczą do kreatora — jak przycisk
  // „Zapisz jako wpis", tylko że wejściem jest zakładka.
  const startNewEntry = () => {
    const pending = getComposerText().trim();
    if (pending) {
      setDraft(textToHtml(pending));
      clearComposerText();
    }
    playSound("entry-new");
  };

  return (
    <nav
      aria-label="Główna nawigacja"
      className="pointer-events-auto border-t bg-background/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto flex w-full max-w-md items-stretch">
        <Link
          href="/entries"
          aria-current={entriesActive ? "page" : undefined}
          className={itemClass(entriesActive)}
        >
          <NotebookText className="size-5" strokeWidth={entriesActive ? 2.4 : 1.8} />
          Dziennik
        </Link>

        <Link
          href="/new"
          onClick={startNewEntry}
          className={itemClass(false)}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-4" strokeWidth={2.4} />
          </span>
          Nowy wpis
        </Link>

        {showFreud && (
          <Link
            href="/chat"
            aria-current={chatActive ? "page" : undefined}
            className={itemClass(chatActive)}
          >
            <Bot className="size-5" strokeWidth={chatActive ? 2.4 : 1.8} />
            Rozmowa
          </Link>
        )}
      </div>
    </nav>
  );
}
