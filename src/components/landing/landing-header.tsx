"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Lekki nagłówek strony marketingowej (`/`). Nawigacja aplikacji jest tu ukryta
 * (patrz `app-header.tsx` / `bottom-bar.tsx`) — landing ma własny pasek z logo,
 * kotwicami i głównym CTA. Bez przełącznika motywu — landing jest zawsze ciemny.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ProLog
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <Link href="#funkcje" className="transition-colors hover:text-foreground">
            Funkcje
          </Link>
          <Link href="#terapeuci" className="transition-colors hover:text-foreground">
            Terapeuci
          </Link>
          <Link href="#plany" className="transition-colors hover:text-foreground">
            Plany
          </Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Dokumentacja
          </Link>
        </nav>
        <Button asChild size="sm">
          <Link href="/welcome">Rozpocznij</Link>
        </Button>
      </div>
    </header>
  );
}
