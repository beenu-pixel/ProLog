"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { useSession } from "@/lib/auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { useActiveTherapist } from "@/lib/active-therapist";
import { loadChat, useTherapistChat } from "@/lib/therapist-chat-store";
import {
  useTherapistConsent,
  useTherapistEnabled,
} from "@/lib/therapist-prefs";
import { Bubble, ConsentGate } from "@/components/therapist-chat";
import { TherapistSwitcher } from "@/components/therapist-switcher";

/**
 * Pełnoekranowa rozmowa z terapeutą — treść trasy `/chat` (zakładka „Freud" na
 * mobilnym pasku). Lista wiadomości przewija się scrollem strony; polem wejścia
 * jest globalny kompozytor (`BottomBar` przełącza go tu w tryb czatu) — dzięki
 * temu w aplikacji jest jedno pole tekstowe, a jego znaczenie wynika z miejsca.
 * Na desktopie widok renderuje się jako wycentrowana kolumna (główną ścieżką
 * pozostaje pływający panel przy kompozytorze).
 *
 * Wyjście: systemowy „wstecz" albo pasek zakładek — bez własnego przycisku X.
 */
export function ChatScreen() {
  const hydrated = useHydrated();
  const session = useSession();
  const [enabledPref] = useTherapistEnabled();
  const [consent, setConsent] = useTherapistConsent();
  const active = useActiveTherapist();
  const { messages, status } = useTherapistChat();
  const endRef = useRef<HTMLDivElement>(null);

  // Historia rozmowy — bez otwierania desktopowego panelu (osobny stan `open`).
  useEffect(() => {
    void loadChat();
  }, []);

  // Trzymaj koniec rozmowy w kadrze (nowe wiadomości, strumień odpowiedzi).
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status, consent]);

  // Przed hydratacją (sesja, preferencje z localStorage) nie pokazujemy gate'ów
  // — unikamy mignięcia „wymaga konta" u zalogowanego.
  if (!hydrated) return null;

  const gate = !session ? (
    <GateCard
      title="Rozmowa z terapeutą wymaga konta"
      body="Zaloguj się, aby rozmawiać o swoich wpisach z cyfrowym terapeutą."
      href="/welcome"
      cta="Zaloguj się"
    />
  ) : !enabledPref ? (
    <GateCard
      title="Rozmowa z terapeutą jest wyłączona"
      body="Włącz ją w Ustawieniach, aby wrócić do rozmowy."
      href="/settings"
      cta="Przejdź do Ustawień"
    />
  ) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
      {gate ? (
        <div className="flex flex-1 items-center justify-center py-10">
          {gate}
        </div>
      ) : (
        <>
          {/* Pod-nagłówek: przełącznik persony (jak selektor modelu w czacie). */}
          <div className="sticky top-14 z-30 -mx-6 bg-background/95 px-6 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <TherapistSwitcher variant="title" placement="down" />
          </div>

          {!consent ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <div className="w-full max-w-md rounded-3xl border bg-background/95 shadow-xl">
                <ConsentGate
                  therapist={active}
                  onAccept={() => setConsent(true)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-3 py-4">
              {/* Stała wiadomość powitalna (UI-only — nie idzie do modelu). */}
              <Bubble
                message={{
                  id: "__greeting__",
                  role: "assistant",
                  content: active.greeting,
                  createdAt: "",
                }}
              />
              {messages.map((message) => (
                <Bubble key={message.id} message={message} />
              ))}
              <div ref={endRef} aria-hidden />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Karta-brama: co jest potrzebne, dlaczego i dokąd dalej. */
function GateCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="w-full max-w-md space-y-3 rounded-3xl border bg-background/95 px-5 py-6 text-sm shadow-xl">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{body}</p>
      <Link
        href={href}
        className="block w-full rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95"
      >
        {cta}
      </Link>
    </div>
  );
}
