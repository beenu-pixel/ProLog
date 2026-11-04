"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Mic, RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";
import { LoadingDots } from "@/components/ui/loading-dots";
import { NavMenu } from "@/components/nav-menu";
import { closeMenu } from "@/lib/nav-menu-store";
import { useProgressRouter } from "@/lib/nav-progress";
import { useTranscription } from "@/hooks/use-transcription";
import { useAiLimit } from "@/hooks/use-ai-limits";
import { useEntries } from "@/hooks/use-entries";
import { useActiveContext } from "@/lib/active-context";
import { useActiveTherapist } from "@/lib/active-therapist";
import { buildJournalContext, buildUiContext } from "@/lib/therapist-context";
import { setDraft, textToHtml } from "@/lib/entry-draft";
import {
  getComposerText,
  setComposerText,
  useComposerText,
} from "@/lib/composer-text";
import { playSound } from "@/lib/sound";
import { sendMessage, useTherapistChat } from "@/lib/therapist-chat-store";
import {
  hasTherapistConsent,
  isAutoSend,
  useTherapistEnabled,
} from "@/lib/therapist-prefs";

/**
 * Pole pisania — jedno w całej aplikacji. Ma dwa tryby, a tryb wynika z
 * KONTEKSTU (bez przełącznika):
 * - `note` (domyślny, Dziennik) — szybka notatka: Enter/przycisk zapisuje treść
 *   jako wersję roboczą i otwiera nowy wpis `/new`; mikrofon dyktuje do pola,
 * - `chat` (trasa `/chat`) — wejście rozmowy: Enter/przycisk wysyła do terapeuty.
 * Zawsze widoczny jest dokładnie JEDEN przycisk akcji — znaczenie pola sygnalizuje
 * placeholder.
 *
 * Tekst pola żyje w `composer-text` (store), żeby przetrwał zmianę trasy i żeby
 * zakładka „Nowy wpis" mogła zabrać go jako wersję roboczą.
 *
 * Bez własnego pozycjonowania — miejsce ustala rodzic: dolny pasek na telefonie
 * (`BottomBar`), kolumna listy w Dzienniku i dół rozmowy na komputerze.
 *
 * Tekst ma 16 px na każdym ekranie: mniejszy sprawia, że iOS przybliża stronę
 * przy wpisywaniu.
 *
 * Lewy przycisk pola: na telefonie, tylko na `/chat` (tam nie ma paska zakładek
 * z „Więcej"), menu (`NavMenu`) z rzadszą nawigacją.
 */
export function ComposerInput({ mode = "note" }: { mode?: "note" | "chat" }) {
  const router = useProgressRouter();
  const text = useComposerText();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const entries = useEntries();
  const active = useActiveContext();
  const therapist = useActiveTherapist();
  const { status } = useTherapistChat();
  const [enabledPref] = useTherapistEnabled();
  const session = useSession();
  const therapistLimit = useAiLimit("therapist");
  const transcribeLimit = useAiLimit("transcribe");

  // Funkcje AI (czat, mikrofon) wyłącznie dla zalogowanych — i tylko gdy rozmowa
  // jest włączona w preferencjach. Niezalogowany nie widzi tych akcji (pole służy
  // mu wyłącznie do notatki → „Zapisz jako wpis").
  const loggedIn = Boolean(session);
  const enabled = enabledPref && loggedIn;
  const chatMode = mode === "chat";

  // Wysyła `value` do terapeuty (gdy włączone, jest zgoda i nie trwa odpowiedź).
  // Bez zgody ekran zgody pokazuje sama strona `/chat`.
  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!enabled || !trimmed || status === "streaming") return;
    if (therapistLimit.blocked) return; // dzienny limit wyczerpany (przycisk i tak wyłączony)
    if (!hasTherapistConsent()) return;
    const journalContext = buildJournalContext(entries);
    const uiContext = buildUiContext(active, entries);
    void sendMessage(trimmed, journalContext, uiContext);
    setComposerText("");
  };

  // Zapisuje treść pola jako wersję roboczą i przenosi do nowego wpisu, gdzie
  // użytkownik ocenia dzień i zatwierdza zapis.
  const saveAsEntry = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setDraft(textToHtml(trimmed));
    playSound("entry-new");
    setComposerText("");
    router.push("/new");
  };

  // Transkrypcja: dopisuje do pola; w trybie czatu przy auto-send od razu wysyła.
  // Tekst czytamy przez `getComposerText()` (nie z domknięcia) — callback może
  // odpalić długo po renderze, w którym powstał.
  const {
    supported,
    listening,
    transcribing,
    error: transcribeError,
    retry: retryTranscribe,
    toggle,
  } = useTranscription((t) => {
    const current = getComposerText();
    const combined = current ? `${current} ${t}` : t;
    if (
      chatMode &&
      isAutoSend() &&
      enabled &&
      hasTherapistConsent() &&
      status !== "streaming" &&
      !therapistLimit.blocked
    ) {
      const journalContext = buildJournalContext(entries);
      const uiContext = buildUiContext(active, entries);
      void sendMessage(combined.trim(), journalContext, uiContext);
      setComposerText("");
      return;
    }
    setComposerText(combined);
  });

  // Pole rośnie do 4 wierszy (16 px, interlinia 24 px), dalej tekst się
  // przewija. Wysokość liczymy po każdej zmianie treści.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 116)}px`;
  }, [text]);

  const hasText = text.trim().length > 0;
  const canSendToFreud =
    enabled && status !== "streaming" && !therapistLimit.blocked;
  const micDisabled =
    !supported || transcribing || (transcribeLimit.blocked && !listening);

  // Okrągły przycisk 44 px — cel dotyku na telefonie, ten sam na komputerze.
  const roundButton =
    "flex size-11 shrink-0 items-center justify-center rounded-full transition-[color,background-color,opacity]";

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Nagrywanie = tryb wyłączności: pełnoekranowa, niewidoczna nakładka
          przechwytuje KAŻDE tapnięcie (także w menu/nawigację) i zamienia je w
          „zatrzymaj nagrywanie" — nic innego się nie wydarzy. Portal do <body>,
          z-[60] nad menu (z-50). Po zatrzymaniu nakładka znika. */}
      {listening &&
        typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            onClick={toggle}
            aria-label="Zatrzymaj nagrywanie"
            className="fixed inset-0 z-[60] cursor-default bg-transparent"
          />,
          document.body
        )}

      {/* Ostrzeżenie o zbliżającym się / wyczerpanym dziennym limicie pytań. */}
      {enabled && chatMode && (therapistLimit.blocked || therapistLimit.nearLimit) && (
        <p className="px-4 text-center text-caption text-muted-foreground">
          {therapistLimit.blocked
            ? "Wykorzystałeś dzienny limit pytań do terapeuty. Odnowi się o północy."
            : `Zostało ${therapistLimit.remaining} pytań do terapeuty na dziś.`}
        </p>
      )}

      {/* Transkrypcja padła na błędzie sieci/serwera — nagranie jest zachowane,
          więc oferujemy ponowienie zamiast po cichu gubić podyktowaną treść. */}
      {transcribeError && !transcribing && (
        <div className="flex items-center justify-center gap-2 px-4 text-center text-caption text-destructive">
          <span>Nie udało się rozpoznać mowy.</span>
          <button
            type="button"
            onClick={retryTranscribe}
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-medium underline-offset-2 transition-colors hover:underline"
          >
            <RotateCw className="size-3" aria-hidden />
            Ponów
          </button>
        </div>
      )}

      <form
        // Znacznik „mikrofon w użyciu" dla CSS w BottomBar: pasek zakładek ma
        // zostać schowany przez całe nagrywanie/transkrypcję (tap w mikrofon
        // zabiera fokus polu, więc sam `textarea:focus` by nie wystarczył).
        data-voice={listening || transcribing ? "" : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (chatMode) submit(text);
          else saveAsEntry(text);
        }}
        className={cn(
          "flex w-full items-end gap-1 rounded-lg border border-input bg-card p-1 transition-colors",
          // Fokus: wyraźniejsza obwódka całego pola zamiast pierścienia na
          // samym tekście (pole tekstowe dostaje :focus-visible przy każdym
          // stuknięciu, więc gruby pierścień byłby krzykliwy).
          "focus-within:border-ring",
          mode !== "chat" && "pl-3"
        )}
      >
        {/* Telefon, tylko /chat: menu rzadszej nawigacji. */}
        {mode === "chat" && <NavMenu className="lg:hidden" menuOrigin="left" />}

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(event) => setComposerText(event.target.value)}
          onFocus={() => {
            // Wejście w pole chowa menu; trybu NIE zmienia (rządzi nim kontekst).
            closeMenu();
          }}
          onKeyDown={(event) => {
            // Enter = akcja bieżącego trybu; Shift+Enter = nowy wiersz.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (chatMode) submit(text);
              else saveAsEntry(text);
            }
          }}
          placeholder={
            listening
              ? "Nagrywam…"
              : transcribing
                ? "Przepisuję…"
                : chatMode
                  ? `Napisz do ${therapist.name}…`
                  : "Napisz notatkę…"
          }
          aria-label={
            chatMode
              ? `Wiadomość do ${therapist.name}`
              : "Notatka do nowego wpisu"
          }
          className={cn(
            "hide-native-scroll max-h-[116px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-body outline-none placeholder:text-muted-foreground focus-visible:outline-none",
            listening && "placeholder:text-destructive"
          )}
        />

        {hasText ? (
          <button
            type="submit"
            disabled={chatMode && !canSendToFreud}
            aria-label={chatMode ? `Wyślij do: ${therapist.name}` : "Zapisz jako wpis"}
            title={
              chatMode && therapistLimit.blocked
                ? "Dzienny limit pytań wykorzystany — odnowi się o północy"
                : chatMode
                  ? `Wyślij do: ${therapist.name}`
                  : "Zapisz jako wpis"
            }
            className={cn(
              roundButton,
              "bg-primary text-primary-foreground hover:bg-primary/90",
              chatMode && !canSendToFreud && "cursor-not-allowed opacity-50"
            )}
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        ) : loggedIn ? (
          <button
            type="button"
            onClick={() => {
              // Pole jest nad tłem menu, więc tap w mikrofon go nie zamyka
              // „sam z siebie" — robimy to jawnie i od razu (jeden tap).
              closeMenu();
              toggle();
            }}
            disabled={micDisabled}
            aria-pressed={listening}
            aria-busy={transcribing}
            aria-label={
              transcribing
                ? "Przepisuję"
                : listening
                  ? "Zatrzymaj nagrywanie"
                  : "Nagraj głos"
            }
            title={
              !supported
                ? "Nagrywanie nie jest wspierane w tej przeglądarce"
                : transcribeLimit.blocked && !listening
                  ? "Dzienny limit transkrypcji wykorzystany — odnowi się o północy"
                  : transcribing
                    ? "Przepisuję"
                    : listening
                      ? "Zatrzymaj nagrywanie"
                      : "Nagraj notatkę głosem"
            }
            className={cn(
              roundButton,
              listening
                ? "bg-destructive text-destructive-foreground"
                : "text-foreground hover:bg-accent",
              micDisabled && "cursor-not-allowed",
              micDisabled && !transcribing && "opacity-50"
            )}
          >
            {transcribing ? (
              <LoadingDots />
            ) : (
              <Mic className={cn("size-5", listening && "animate-pulse")} aria-hidden />
            )}
          </button>
        ) : null}
      </form>
    </div>
  );
}
