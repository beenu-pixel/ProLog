"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Mic, NotebookPen, SendHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";
import { NavMenu } from "@/components/nav-menu";
import { closeMenu } from "@/lib/nav-menu-store";
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
import {
  sendMessage,
  setOpen,
  useTherapistChat,
} from "@/lib/therapist-chat-store";
import {
  hasTherapistConsent,
  isAutoSend,
  useTherapistEnabled,
} from "@/lib/therapist-prefs";
import { TherapistChat } from "@/components/therapist-chat";

/**
 * „Pigułka" dolnego pola kontekstowego — wspólna dla mobile i desktopu. Ma dwa
 * tryby, a tryb wynika z KONTEKSTU (bez przełącznika):
 * - `note` (domyślny, trasy dziennika) — szybka notatka: Enter/przycisk zapisuje
 *   treść jako wersję roboczą i otwiera kreator `/new`; mikrofon dyktuje do pola,
 * - `chat` (trasa `/chat`; na desktopie także otwarty panel Freuda) — wejście
 *   rozmowy: Enter/przycisk wysyła do terapeuty.
 * Zawsze widoczny jest dokładnie JEDEN przycisk akcji — znaczenie pola sygnalizują
 * placeholder i ikona/kolor przycisku.
 *
 * Tekst pola żyje w `composer-text` (store), żeby przetrwał zmianę trasy i żeby
 * zakładka „Nowy wpis" mogła zabrać go jako wersję roboczą.
 *
 * Bez własnego pozycjonowania — układ (fixed, odstępy) ustala `BottomBar`.
 *
 * Lewy przycisk pola: na mobile hamburger (`NavMenu`) z rzadszą nawigacją; na
 * desktopie ikona Bota — jawny przełącznik trybu (otwiera/zamyka panel rozmowy),
 * ukryta na `/chat`, gdzie trybem rządzi trasa.
 */
export function ComposerInput({ mode = "note" }: { mode?: "note" | "chat" }) {
  const router = useRouter();
  const text = useComposerText();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const entries = useEntries();
  const active = useActiveContext();
  const therapist = useActiveTherapist();
  const { status, open } = useTherapistChat();
  const [enabledPref] = useTherapistEnabled();
  const session = useSession();
  const therapistLimit = useAiLimit("therapist");
  const transcribeLimit = useAiLimit("transcribe");

  // Funkcje AI (czat z Freudem, mikrofon) wyłącznie dla zalogowanych — i tylko
  // gdy rozmowa jest włączona w preferencjach. Niezalogowany nie widzi tych akcji
  // (pole służy mu wyłącznie do notatki → „Zapisz jako wpis").
  const loggedIn = Boolean(session);
  const enabled = enabledPref && loggedIn;

  // Tryb czatu: trasa `/chat` (mobile i desktop) LUB otwarty panel (desktop —
  // po fazie store'ów `open` ustawia wyłącznie desktopowy przełącznik Bota).
  const chatMode = mode === "chat" || open;

  // Panel trzymamy zamontowany przez czas animacji wyjścia: gdy `open` schodzi
  // do false, najpierw odtwarzamy animację (`closing`), a dopiero po niej
  // odmontowujemy. Otwarcie w trakcie zamykania (cleanup) anuluje odmontowanie.
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- montaż panelu na czas animacji wejścia
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  // Wysyła `value` do terapeuty (gdy włączone, jest zgoda i nie trwa odpowiedź).
  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!enabled || !trimmed || status === "streaming") return;
    if (therapistLimit.blocked) return; // dzienny limit wyczerpany (przycisk i tak wyłączony)
    if (!hasTherapistConsent()) {
      // Na `/chat` ekran zgody pokazuje sama strona; na desktopie otwieramy panel.
      if (mode !== "chat") setOpen(true);
      return;
    }
    const journalContext = buildJournalContext(entries);
    const uiContext = buildUiContext(active, entries);
    void sendMessage(trimmed, journalContext, uiContext);
    setComposerText("");
  };

  // Zapisuje treść pola jako wersję roboczą i przenosi do kreatora wpisu, gdzie
  // użytkownik wybiera metryki (jak się czuje) i zatwierdza zapis.
  const saveAsEntry = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setDraft(textToHtml(trimmed));
    playSound("entry-new");
    setOpen(false);
    setComposerText("");
    router.push("/new");
  };

  // Transkrypcja: dopisuje do pola; w trybie czatu przy auto-send od razu wysyła.
  // Tekst czytamy przez `getComposerText()` (nie z domknięcia) — callback może
  // odpalić długo po renderze, w którym powstał.
  const { supported, listening, transcribing, toggle } = useTranscription((t) => {
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

  // Pole rośnie do ~4 wierszy (text-sm, leading-5 ≈ 20px), dalej tekst się
  // przewija. Wysokość liczymy po każdej zmianie treści.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
  }, [text]);

  const hasText = text.trim().length > 0;
  const canSendToFreud =
    enabled && status !== "streaming" && !therapistLimit.blocked;
  const micDisabled =
    !supported || transcribing || (transcribeLimit.blocked && !listening);

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Nagrywanie = tryb wyłączności: pełnoekranowa, niewidoczna nakładka
          przechwytuje KAŻDE tapnięcie (także w hamburger/nawigację) i zamienia
          je w „zatrzymaj nagrywanie" — nic innego się nie wydarzy. Portal do
          <body> (glass-panel ma backdrop-blur → przycinałby fixed), z-[60] nad
          menu (z-50). Po zatrzymaniu nakładka znika i interakcje wracają. */}
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

      {/* Panel rozmowy z Freudem (desktop) — pływa NAD paskiem. Na `/chat`
          rozmowa jest treścią strony, więc panelu nie montujemy. */}
      {enabled && mounted && mode !== "chat" && (
        <TherapistChat closing={closing} />
      )}

      {/* Ostrzeżenie o zbliżającym się / wyczerpanym dziennym limicie pytań. */}
      {enabled && chatMode && (therapistLimit.blocked || therapistLimit.nearLimit) && (
        <p className="px-3 text-center text-xs text-muted-foreground">
          {therapistLimit.blocked
            ? "Wykorzystałeś dzienny limit pytań do terapeuty. Odnowi się o północy."
            : `Zostało ${therapistLimit.remaining} pytań do terapeuty na dziś.`}
        </p>
      )}

      {/* Desktop: zakładki trybu NAD polem (uszko karty przy lewym rogu) —
          jawnie rozdzielają „piszę notatkę" od „piszę do persony" (mobilny
          odpowiednik to zakładki Dziennik/Rozmowa), nie zabierając polu ani
          piksela szerokości. Aktywny segment = bieżący tryb; klik otwiera/zamyka
          panel rozmowy. Na `/chat` zbędne (trybem rządzi trasa), bez włączonej
          rozmowy pole jest tylko do notatek — wtedy ich nie ma. */}
      {enabled && mode !== "chat" && (
        <div className="hidden lg:flex">
          <div
            role="tablist"
            aria-label="Tryb pola"
            className="ml-3 flex items-center rounded-full border bg-background/85 p-0.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!chatMode}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                !chatMode
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <NotebookPen className="size-3.5" />
              Notatka
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={chatMode}
              onClick={() => setOpen(true)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                chatMode
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bot className="size-3.5" />
              Rozmowa
            </button>
          </div>
        </div>
      )}

      {/* Jeden, wspólny glass-panel: pole + (na mobile) nawigacja pod nim.
          Na desktopie panel jest przezroczysty — pole ma własną pastylkę. */}
      <div
        className={cn(
          "w-full overflow-hidden rounded-[1.75rem] border bg-background/85 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70",
          "lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:backdrop-blur-none lg:supports-[backdrop-filter]:bg-transparent"
        )}
      >
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
            "flex min-h-16 w-full items-center gap-1.5 px-3 py-2.5",
            "lg:rounded-[1.75rem] lg:border lg:bg-background/85 lg:shadow-lg lg:backdrop-blur lg:supports-[backdrop-filter]:bg-background/70"
          )}
        >
        {/* Mobile: hamburger → menu rzadszej nawigacji. */}
        <NavMenu className="lg:hidden" menuOrigin="left" />

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
            chatMode ? `Napisz do ${therapist.name}…` : "Napisz notatkę…"
          }
          aria-label={
            chatMode
              ? `Wiadomość do ${therapist.name}`
              : "Notatka do nowego wpisu"
          }
          className="hide-native-scroll max-h-20 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent p-0 text-sm leading-5 outline-none placeholder:text-muted-foreground"
        />

        {hasText ? (
          chatMode ? (
            // Tryb czatu: wyślij do terapeuty.
            <button
              type="submit"
              disabled={!canSendToFreud}
              aria-label={`Wyślij do: ${therapist.name}`}
              title={
                therapistLimit.blocked
                  ? "Dzienny limit pytań wykorzystany — odnowi się o północy"
                  : `Wyślij do: ${therapist.name}`
              }
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95",
                !canSendToFreud &&
                  "cursor-not-allowed opacity-50 hover:scale-100"
              )}
            >
              <SendHorizontal className="size-5" />
            </button>
          ) : (
            // Tryb notatki: zapisz jako wpis (kreator `/new`).
            <button
              type="submit"
              aria-label="Zapisz jako wpis"
              title="Zapisz jako wpis"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              <NotebookPen className="size-5" />
            </button>
          )
        ) : loggedIn ? (
          <button
            type="button"
            onClick={() => {
              // Composer jest nad backdropem menu, więc tap w mikrofon go nie
              // zamyka „sam z siebie" — robimy to jawnie i od razu (jeden tap).
              closeMenu();
              toggle();
            }}
            disabled={micDisabled}
            aria-pressed={listening}
            aria-busy={transcribing}
            aria-label={
              transcribing
                ? "Transkrypcja…"
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
                    ? "Transkrypcja…"
                    : listening
                      ? "Zatrzymaj nagrywanie"
                      : "Nagraj notatkę głosem"
            }
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full transition-transform",
              listening
                ? "bg-destructive text-white"
                : "bg-primary text-primary-foreground hover:scale-105 active:scale-95",
              micDisabled && "cursor-not-allowed opacity-50 hover:scale-100"
            )}
          >
            {transcribing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Mic className={cn("size-5", listening && "animate-pulse")} />
            )}
          </button>
        ) : null}
        </form>
      </div>
    </div>
  );
}
