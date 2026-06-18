"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSoundEnabled } from "@/lib/settings";
import { useAnimationsEnabled } from "@/lib/motion";
import {
  useAutoSend,
  useTherapistConsent,
  useTherapistEnabled,
} from "@/lib/therapist-prefs";
import { clearHistory, selectTherapist } from "@/lib/therapist-chat-store";
import { THERAPISTS } from "@/lib/therapists";
import { useActiveTherapist } from "@/lib/active-therapist";
import { useSession, signOut } from "@/lib/auth";
import { ApiTokenManager } from "@/components/api-token-manager";
import { UsageDashboard } from "@/components/usage-dashboard";
import { PageScroll } from "@/components/page-scroll";
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
  const [animationsEnabled, setAnimationsEnabled] = useAnimationsEnabled();
  const animationsOn = hydrated ? animationsEnabled : true;
  const session = useSession();

  const therapist = useActiveTherapist();
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
    <PageScroll>
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
          Animacje
        </h2>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Animacje interfejsu</p>
            <p className="text-sm text-muted-foreground">
              Płynne przejścia (pojawianie wpisów, rozwijanie menu, zmiana motywu).
              Wyłącz, by interfejs reagował natychmiast.
            </p>
          </div>
          <Toggle
            checked={animationsOn}
            onChange={setAnimationsEnabled}
            label="Animacje interfejsu"
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
            <Button asChild variant="outline" size="sm">
              <Link href="/welcome?next=/settings">Zaloguj się</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Sekcje powiązane z AI/kluczami — wyłącznie dla zalogowanych. Niezalogowany
          nie ma widzieć, że transkrypcja, terapeuta i klucze API w ogóle istnieją. */}
      {session && (
        <>
      <UsageDashboard />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Klucze API (Personal Access Token)
          </h2>
          <a
            href="/docs"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Dokumentacja API
          </a>
        </div>
        <ApiTokenManager />
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Terapeuta ({therapist.name})
        </h2>

        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Wybór persony</p>
            <p className="text-sm text-muted-foreground">
              Z kim chcesz rozmawiać. Każda persona ma osobny wątek rozmowy.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {THERAPISTS.map((t) => {
              const isActive = hydrated && t.id === therapist.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void selectTherapist(t.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:bg-secondary",
                    isActive && "border-foreground bg-secondary"
                  )}
                >
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-medium">
                      {t.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.title}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Rozmowa z terapeutą</p>
            <p className="text-sm text-muted-foreground">
              Czat z {therapist.name} na podstawie Twoich wpisów,
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
        </>
      )}

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
    </PageScroll>
  );
}
