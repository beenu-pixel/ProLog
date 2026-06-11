"use client";

import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSoundEnabled } from "@/lib/settings";
import {
  useAutoSend,
  useTherapistConsent,
  useTherapistEnabled,
} from "@/lib/therapist-prefs";
import { clearHistory } from "@/lib/therapist-chat-store";
import { DEFAULT_THERAPIST } from "@/lib/therapists";
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

  const [therapistEnabled, setTherapistEnabled] = useTherapistEnabled();
  const [autoSend, setAutoSend] = useAutoSend();
  const [consent, setConsent] = useTherapistConsent();
  const therapistOn = hydrated ? therapistEnabled : true;
  const autoSendOn = hydrated && autoSend;
  const consentGiven = hydrated && consent;

  const handleClearHistory = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Usunąć całą historię rozmów z terapeutą?")
    ) {
      return;
    }
    clearHistory();
  };

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
          Terapeuta ({DEFAULT_THERAPIST.name})
        </h2>

        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Rozmowa z terapeutą</p>
            <p className="text-sm text-muted-foreground">
              Czat z {DEFAULT_THERAPIST.name} na podstawie Twoich wpisów,
              dostępny w dolnym pasku.
            </p>
          </div>
          <Toggle
            checked={therapistOn}
            onChange={setTherapistEnabled}
            label="Rozmowa z terapeutą"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Wyślij od razu po dyktowaniu</p>
            <p className="text-sm text-muted-foreground">
              Po nagraniu głosem wiadomość poleci bez dodatkowego potwierdzenia.
            </p>
          </div>
          <Toggle
            checked={autoSendOn}
            onChange={setAutoSend}
            label="Wyślij od razu po dyktowaniu"
          />
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Prywatność i dane</p>
            <p className="text-sm text-muted-foreground">
              Aby terapeuta mógł analizować dziennik, treść wpisów jest wysyłana
              do modelu AI (xAI). {consentGiven
                ? "Zgoda została udzielona."
                : "Zgoda nie została jeszcze udzielona."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {consentGiven && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConsent(false)}
              >
                Cofnij zgodę
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleClearHistory}
            >
              Wyczyść historię rozmów
            </Button>
          </div>
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
