"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  NotebookText,
  BarChart3,
  Settings,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Hamburger + menu nawigacji wysuwane w GÓRĘ nad dolnym paskiem. Zastępuje dawny
 * rząd ikon pod polem oraz ikonę AI po lewej w kompozytorze — całą nawigację
 * (Dziennik, Statystyki, Ustawienia, Dokumentacja) chowamy tu pod jedną ikoną.
 * Rozmowa z Freudem nie jest pozycją menu — jest dostępna z dolnego paska
 * (przyciski) po zalogowaniu.
 *
 * Komponent jest samowystarczalny (własny stan, backdrop, animacja). Renderujemy
 * go na mobile: w kompozytorze (lewy przycisk) oraz na trasach „tylko nawigacja".
 * Panel pływa nad paskiem (fixed), więc nie zależy od układu rodzica.
 */
interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

const ITEMS: MenuItem[] = [
  {
    href: "/entries",
    label: "Dziennik",
    icon: NotebookText,
    isActive: (p) => p === "/" || p.startsWith("/entries"),
  },
  {
    href: "/stats",
    label: "Statystyki",
    icon: BarChart3,
    isActive: (p) => p.startsWith("/stats"),
  },
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

export function NavMenu({ className }: { className?: string }) {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  // Panel trzymamy zamontowany na czas animacji wyjścia (jak TherapistChat).
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

  // Zamknij po zmianie trasy oraz na Escape.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- zamknięcie menu po nawigacji
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu nawigacji"
        aria-expanded={open}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          open ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <Menu className="size-5" />
      </button>

      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
        // Portal do <body>: dolny pasek ma `backdrop-blur` + `overflow-hidden`,
        // co czyni go blokiem zawierającym dla `fixed` i przycinałoby panel —
        // dlatego renderujemy overlay poza nim, względem viewportu.
        <>
          {/* Backdrop — klik poza menu zamyka. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />

          {/* Panel — pływa nad paskiem i wysuwa się w górę. */}
          <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
            <div
              className={cn(
                "w-full max-w-md overflow-hidden rounded-3xl border bg-background/95 shadow-xl backdrop-blur ease-out supports-[backdrop-filter]:bg-background/80 motion-reduce:animate-none",
                closing
                  ? "duration-200 animate-out fade-out slide-out-to-bottom-4"
                  : "duration-300 animate-in fade-in slide-in-from-bottom-4"
              )}
            >
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-semibold">Menu</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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
                      onClick={() => setOpen(false)}
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
