"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  FileText,
  LogOut,
  NotebookText,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import { signOut, useSession } from "@/lib/auth";
import { startNewEntry } from "@/lib/new-entry";
import { useTherapistEnabled } from "@/lib/therapist-prefs";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

/**
 * Pasek boczny na komputerze (lg+) — jedyna nawigacja aplikacji, odpowiednik
 * dolnego paska z telefonu. Te same nazwy sekcji w tej samej kolejności:
 * Dziennik, Rozmowa, Statystyki, a rzadsze (Ustawienia, Dokumentacja) na dole,
 * jak „Więcej”. Akcja główna („Nowy wpis”) stoi nad nawigacją.
 *
 * Konto na dole: e-mail i wylogowanie (przycisk czeka z napisem „Wylogowuję”,
 * dopóki wylogowanie się nie skończy), a gościowi — wejście do logowania.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const session = useSession();
  const [enabledPref] = useTherapistEnabled();
  const [signingOut, setSigningOut] = useState(false);

  // Landing i ekran logowania mają własny układ, bez nawigacji aplikacji.
  if (pathname === "/" || pathname === "/welcome") return null;

  const showChat = Boolean(session) && enabledPref;

  const main: NavItem[] = [
    {
      href: "/entries",
      label: "Dziennik",
      icon: NotebookText,
      active: pathname.startsWith("/entries") || pathname === "/new",
    },
    ...(showChat
      ? [{ href: "/chat", label: "Rozmowa", icon: Bot, active: pathname.startsWith("/chat") }]
      : []),
    {
      href: "/stats",
      label: "Statystyki",
      icon: BarChart3,
      active: pathname.startsWith("/stats"),
    },
  ];

  const more: NavItem[] = [
    {
      href: "/settings",
      label: "Ustawienia",
      icon: Settings,
      active: pathname.startsWith("/settings"),
    },
    {
      href: "/docs",
      label: "Dokumentacja",
      icon: FileText,
      active: pathname.startsWith("/docs"),
    },
  ];

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  const email = session?.user.email ?? null;

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-background px-3 py-4 lg:flex">
      <Link
        href="/entries"
        className="flex h-10 items-center rounded-md px-3 text-title font-semibold"
      >
        ProLog
      </Link>

      <Button asChild className="mt-4 mb-6 w-full justify-start">
        <Link href="/new" onClick={startNewEntry}>
          <Plus className="size-4" strokeWidth={2.25} aria-hidden />
          Nowy wpis
        </Link>
      </Button>

      <nav aria-label="Główna nawigacja" className="flex flex-col gap-1">
        {main.map((item) => (
          <SidebarLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="flex-1" />

      <nav aria-label="Więcej" className="flex flex-col gap-1">
        {more.map((item) => (
          <SidebarLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="mt-4 border-t pt-4">
        {session ? (
          <div className="space-y-2 px-3">
            <p className="text-caption text-subtle-foreground">Zalogowano jako</p>
            <p className="truncate text-ui font-medium" title={email ?? undefined}>
              {email ?? "Twoje konto"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-busy={signingOut}
              className="-ml-3 text-muted-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              {signingOut ? "Wylogowuję" : "Wyloguj się"}
              {signingOut && <LoadingDots />}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 px-3">
            <p className="text-caption text-subtle-foreground">
              Wpisy są tylko w tej przeglądarce.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/welcome">Zaloguj się</Link>
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-ui font-medium transition-colors",
        item.active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-5" strokeWidth={item.active ? 2.25 : 1.75} aria-hidden />
      {item.label}
    </Link>
  );
}
