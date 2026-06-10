"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession, signOut } from "@/lib/auth";

/**
 * Zakładka „Konto" w nagłówku (tylko desktop), obok przełącznika motywu.
 * Rozwija się po najechaniu lub kliknięciu: pokazuje adres e-mail i wylogowanie
 * (a gdy nikt nie jest zalogowany — link do ekranu logowania).
 *
 * Panel jest osadzony jako potomek kontenera i sięga aż do przycisku (odstęp robi
 * `pt-2` w środku), więc kursor przechodzi z zakładki na panel bez gubienia
 * hovera (brak „dziury", która zamykałaby menu).
 */
export function AccountMenu() {
  const session = useSession();
  const [open, setOpen] = useState(false);

  const email = session?.user.email ?? null;

  return (
    <div
      className="relative hidden lg:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
          open
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <UserCircle className="size-4" />
        <span>Konto</span>
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 pt-2">
          <div
            role="menu"
            className="w-64 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
          >
            {session ? (
              <>
                <p className="text-xs text-muted-foreground">Zalogowano jako</p>
                <p className="mt-0.5 truncate text-sm font-medium">
                  {email ?? "Twoje konto"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void signOut();
                  }}
                  className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <LogOut className="size-4" />
                  Wyloguj się
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Nie jesteś zalogowany.
                </p>
                <Link
                  href="/welcome"
                  onClick={() => setOpen(false)}
                  className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <UserCircle className="size-4" />
                  Zaloguj się
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
