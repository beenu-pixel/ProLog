"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";

import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();

  // Ekran powitalny ma własny układ — bez nagłówka aplikacji.
  if (pathname === "/welcome") return null;

  const entriesActive =
    pathname === "/" || pathname.startsWith("/entries") || pathname === "/new";
  const statsActive = pathname.startsWith("/stats");
  const settingsActive = pathname.startsWith("/settings");
  const docsActive = pathname.startsWith("/docs");

  const link = (active: boolean) =>
    cn(
      "text-sm transition-colors",
      active
        ? "font-medium text-foreground"
        : "text-muted-foreground hover:text-foreground"
    );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/entries" className="text-lg font-semibold tracking-tight">
            ProLog
          </Link>
          <nav className="hidden items-center gap-5 lg:flex">
            <Link href="/entries" className={link(entriesActive)}>
              Dziennik
            </Link>
            <Link href="/stats" className={link(statsActive)}>
              Statystyki
            </Link>
            <Link href="/settings" className={link(settingsActive)}>
              Ustawienia
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <AccountMenu />
          <Link
            href="/docs"
            aria-label="Dokumentacja API"
            title="Dokumentacja API"
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors",
              docsActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="size-5" strokeWidth={docsActive ? 2.4 : 1.8} />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
