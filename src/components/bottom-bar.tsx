"use client";

import { usePathname } from "next/navigation";

import { ComposerInput } from "@/components/composer-input";
import { NavMenu } from "@/components/nav-menu";

/**
 * Pływający dolny pasek (mobile-first). Całą nawigację chowamy pod jedną ikoną
 * hamburgera (`NavMenu`), która rozwija menu w górę — dzięki temu pasek jest
 * niski i nie zajmuje dołu ekranu.
 *
 * Zachowanie wg trasy:
 * - `/welcome`, formularze (`/new`, `/…/edit`) → ukryty w całości,
 * - `/docs`, `/settings` → kompaktowa pastylka z samym hamburgerem (mobile;
 *   wyrównana do prawej — w zasięgu kciuka przy obsłudze jedną ręką;
 *   na desktopie nic — nawigacja jest w nagłówku),
 * - pozostałe → kompozytor (pole + hamburger po lewej na mobile).
 */
export function BottomBar() {
  const pathname = usePathname();

  // Landing (`/`), ekran powitalny i formularze mają własny układ — bez paska.
  const isForm = pathname === "/new" || pathname.endsWith("/edit");
  if (isForm || pathname === "/welcome" || pathname === "/") return null;

  // Trasy „tylko nawigacja": bez pola/tworzenia wpisu — sam hamburger (mobile).
  const navOnly = pathname === "/settings" || pathname.startsWith("/docs");
  if (navOnly) {
    return (
      <div className="fixed inset-x-0 bottom-5 z-40 flex justify-end px-4 lg:hidden">
        <div className="flex items-center rounded-full border bg-background/85 px-2 py-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <NavMenu menuOrigin="right" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:bottom-6">
      <div className="w-full max-w-md lg:max-w-2xl">
        <ComposerInput />
      </div>
    </div>
  );
}
