"use client";

import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSoundEnabled } from "@/lib/settings";
import { useSession, signInWithGoogle, signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
        // Włączony = wypełnienie foreground (czarny w jasnym / biały w ciemnym),
        // kropka to background (biała / czarna). Wyłączony = neutralne tło.
        checked ? "border-foreground bg-foreground" : "border-transparent bg-secondary"
      )}
    >
      <span
        className={cn(
          "absolute size-5 rounded-full bg-background shadow-md transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const hydrated = useHydrated();
  const [soundEnabled, setSoundEnabled] = useSoundEnabled();
  const soundOn = hydrated && soundEnabled;
  const session = useSession();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ustawienia</h1>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dźwięki
        </h2>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Efekty dźwiękowe</p>
            <p className="text-sm text-muted-foreground">
              Subtelne dźwięki przy dodawaniu, zapisie i zmianie motywu.
            </p>
          </div>
          <Toggle
            checked={soundOn}
            onChange={setSoundEnabled}
            label="Efekty dźwiękowe"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Konto
        </h2>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">
              {session ? "Zalogowano" : "Zarządzanie kontem"}
            </p>
            <p className="text-sm text-muted-foreground">
              {session
                ? session.user.email ??
                  "Wpisy synchronizowane z chmurą."
                : "Zaloguj się, aby synchronizować wpisy między urządzeniami."}
            </p>
          </div>
          {session ? (
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Wyloguj
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => signInWithGoogle()}
            >
              Zaloguj przez Google
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          O aplikacji
        </h2>
        <div className="space-y-1 rounded-xl border p-4 text-sm">
          <p className="font-medium">ProLog — dziennik</p>
          <p className="text-muted-foreground">Wersja 0.1.0</p>
          <p className="text-muted-foreground">
            Osobisty dziennik refleksji. Dane zapisywane lokalnie w przeglądarce,
            a po zalogowaniu synchronizowane z chmurą.
          </p>
        </div>
      </section>
    </div>
  );
}
