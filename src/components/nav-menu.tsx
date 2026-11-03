"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Settings,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useNavMenu, closeMenu, toggleMenu } from "@/lib/nav-menu-store";

/**
 * Hamburger + menu nawigacji wysuwane w GÓRĘ nad dolnym paskiem. Trzyma RZADZIEJ
 * używane sekcje (Ustawienia, Dokumentacja) — najczęstsze cele (Dziennik,
 * Rozmowa, Nowy wpis, Statystyki) są zakładkami stałego dolnego paska
 * (`BottomTabBar`).
 *
 * Komponent jest samowystarczalny (własny stan, backdrop, animacja). Renderujemy
 * go na mobile jako ostatnią zakładkę paska, „Więcej" (`variant="tab"`), a na
 * `/chat`, gdzie paska nie ma, jako lewy przycisk kompozytora. Panel pływa nad
 * paskiem (fixed), więc nie zależy od układu rodzica.
 */
interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

const ITEMS: MenuItem[] = [
  {
    href: "/settings",
    label: "Ustawienia",
    icon: Settings,
    isActive: (p) => p.startsWith("/settings"),
  },
  {
    href: "/docs",
    label: "Dokumentacja",
    icon: FileText,
    isActive: (p) => p.startsWith("/docs"),
  },
];

export function NavMenu({
  className,
  menuOrigin = "left",
  variant = "icon",
}: {
  className?: string;
  /** Narożnik, z którego panel „wyrasta" — pod pozycją przycisku. */
  menuOrigin?: "left" | "right";
  /** `icon` — okrągły przycisk w polu; `tab` — zakładka „Więcej", jak w `BottomTabBar`. */
  variant?: "icon" | "tab";
}) {
  const pathname = usePathname();
  const isTab = variant === "tab";

  // Stan otwarcia żyje w storze menu (koordynacja z panelem Freuda — wykluczanie
  // i auto-powrót). Montaż/animacja wyjścia zostają lokalne, sterowane przez `open`.
  const { open } = useNavMenu();
  // Zakładka „Więcej" świeci także wtedy, gdy jesteś w jednej z jej sekcji.
  const highlighted = open || (isTab && ITEMS.some((item) => item.isActive(pathname)));
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- montaż na czas animacji wejścia
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  // Zamknij po zmianie trasy (nawigacja) oraz na Escape.
  useEffect(() => closeMenu(), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const itemClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
      active
        ? "bg-accent font-medium text-foreground"
        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
    );

  return (
    <>
      <button
        type="button"
        onClick={() => toggleMenu()}
        // Zakładka ma widoczny podpis „Więcej" — to on jest jej nazwą dla czytnika.
        aria-label={isTab ? undefined : "Menu nawigacji"}
        aria-expanded={open}
        className={cn(
          "flex shrink-0 items-center justify-center transition-colors",
          isTab
            ? "min-h-14 w-full flex-col gap-0.5 pt-1.5 pb-1 text-xs leading-none"
            : "size-9 rounded-full",
          highlighted ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          isTab && highlighted && "font-medium",
          className
        )}
      >
        <Menu
          className="size-5"
          strokeWidth={isTab ? (highlighted ? 2.4 : 1.8) : undefined}
        />
        {isTab && "Więcej"}
      </button>

      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
        // Portal do <body>: dolny pasek ma `backdrop-blur` + `overflow-hidden`,
        // co czyni go blokiem zawierającym dla `fixed` i przycinałoby panel —
        // dlatego renderujemy overlay poza nim, względem viewportu.
        <>
          {/* Backdrop — klik poza menu zamyka. Woal jest CELOWO lekki i BEZ
              rozmycia: rozmowa pod menu ma pozostać czytelna (użytkownik chce
              widzieć czaty, gdy zagląda w menu). Wystarczy tyle, żeby czarny
              dymek własnej wiadomości nie raził obok węższego panelu — mocniejszy
              woal / `backdrop-blur` gasił całą konwersację, więc ich nie wracamy.
              Composer (z-50) jest NAD woalem — zostaje wyraźny. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => closeMenu()}
            className="fixed inset-0 z-40 cursor-default bg-background/40"
          />

          {/* Panel — pływa nad composerem (z-50) i paskiem zakładek, wysuwa się
              w górę. Siada tuż nad polem dzięki `--bottom-nav-h` (wysokość całego
              dolnego obszaru z BottomBar) — na `/chat` bez paska zakładek pole
              jest niżej, więc menu też, zamiast wisieć z dużą przerwą. Fallback
              10rem, gdy zmiennej nie ma. */}
          <div
            style={{ bottom: "calc(var(--bottom-nav-h, 10rem) + 0.5rem)" }}
            className="fixed inset-x-0 z-[55] flex justify-center px-4"
          >
            <div
              className={cn(
                "w-full max-w-md overflow-hidden rounded-3xl border bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/80 motion-reduce:animate-none",
                menuOrigin === "right" ? "origin-bottom-right" : "origin-bottom-left",
                closing ? "nav-menu-out" : "nav-menu-in"
              )}
            >
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-semibold">Więcej</p>
                <button
                  type="button"
                  onClick={() => closeMenu()}
                  aria-label="Zamknij menu"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <nav className="space-y-0.5 p-2">
                {ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = item.isActive(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => closeMenu()}
                      className={itemClass(active)}
                    >
                      <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </>,
          document.body
        )}
    </>
  );
}
