"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, NotebookText, Plus } from "lucide-react";

import { NavMenu } from "@/components/nav-menu";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";
import { useTherapistEnabled } from "@/lib/therapist-prefs";
import { startNewEntry } from "@/lib/new-entry";

/**
 * Stały dolny pasek zakładek (tylko telefon) — najczęstsze cele jednym
 * stuknięciem: Dziennik, Rozmowa (czat z aktywną personą — etykieta celowo bez
 * imienia, bo person jest kilka), Nowy wpis, Statystyki oraz „Więcej” (`NavMenu`:
 * Ustawienia, Dokumentacja). Dokowany do samej krawędzi ekranu (safe-area).
 *
 * „Nowy wpis” to akcja, nie sekcja — stąd ikona w wypełnionej pigułce i miejsce
 * na środku pięciu zakładek. Stuknięcie zabiera ewentualny tekst z pola pisania
 * jako wersję roboczą (nie gubimy pracy użytkownika). Rozmowa jest widoczna tylko
 * dla zalogowanych z włączoną rozmową (jak reszta UI AI) — bez niej zakładek są
 * cztery.
 *
 * Aktywna zakładka różni się nie tylko kolorem: ma pełną tintę, grubszą ikonę
 * i pogrubiony podpis.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const session = useSession();
  const [enabledPref] = useTherapistEnabled();
  const showFreud = Boolean(session) && enabledPref;

  const entriesActive = pathname === "/" || pathname.startsWith("/entries");
  const chatActive = pathname.startsWith("/chat");
  const statsActive = pathname.startsWith("/stats");

  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1 text-caption transition-colors",
      active
        ? "font-medium text-foreground"
        : "text-subtle-foreground hover:text-foreground"
    );

  const icon = (active: boolean) => ({
    className: "size-6",
    strokeWidth: active ? 2.25 : 1.75,
    "aria-hidden": true,
  });

  return (
    <nav
      aria-label="Główna nawigacja"
      className="pointer-events-auto bg-background pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="mx-auto flex w-full max-w-md items-stretch">
        <Link
          href="/entries"
          aria-current={entriesActive ? "page" : undefined}
          className={itemClass(entriesActive)}
        >
          <NotebookText {...icon(entriesActive)} />
          Dziennik
        </Link>

        {showFreud && (
          <Link
            href="/chat"
            aria-current={chatActive ? "page" : undefined}
            className={itemClass(chatActive)}
          >
            <Bot {...icon(chatActive)} />
            Rozmowa
          </Link>
        )}

        <Link href="/new" onClick={startNewEntry} className={itemClass(false)}>
          <span className="flex h-6 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-5" strokeWidth={2.25} aria-hidden />
          </span>
          <span className="text-foreground">Nowy wpis</span>
        </Link>

        <Link
          href="/stats"
          aria-current={statsActive ? "page" : undefined}
          className={itemClass(statsActive)}
        >
          <BarChart3 {...icon(statsActive)} />
          Statystyki
        </Link>

        <NavMenu variant="tab" menuOrigin="right" className="flex-1" />
      </div>
    </nav>
  );
}
