"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Mic, NotebookPen, SendHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";
import { NavMenu } from "@/components/nav-menu";
import { closeMenu } from "@/lib/nav-menu-store";
import { useTranscription } from "@/hooks/use-transcription";
import { useEntries } from "@/hooks/use-entries";
import { useActiveContext } from "@/lib/active-context";
import { buildJournalContext, buildUiContext } from "@/lib/therapist-context";
import { setDraft } from "@/lib/entry-draft";
import { playSound } from "@/lib/sound";
import {
  sendMessage,
  setOpen,
  toggleOpen,
  useTherapistChat,
} from "@/lib/therapist-chat-store";
import {
  hasTherapistConsent,
  isAutoSend,
  useTherapistEnabled,
} from "@/lib/therapist-prefs";
import { TherapistChat } from "@/components/therapist-chat";

/** Zamienia zwykły tekst z pola na prosty HTML (akapity), zgodny z edytorem
 *  TipTap w kreatorze i widokiem szczegółu wpisu. Escape’ujemy znaki HTML. */
function textToHtml(text: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * „Pigułka" dolnego pola kontekstowego — wspólna dla mobile i desktopu. Pełni
 * podwójną rolę: rozmowa z terapeutą (Freud) ORAZ szybkie utworzenie wpisu.
 * Po wpisaniu/nadyktowaniu tekstu widać dwie akcje: „Zapisz jako wpis"
 * (przekazuje treść do kreatora `/new`) oraz „Wyślij do Freuda". Pole działa do
 * notatek nawet, gdy rozmowa z terapeutą jest wyłączona — wtedy gateujemy tylko
 * akcję Freuda. Panel rozmowy montuje się nad polem (gdy otwarty).
 *
 * Bez własnego pozycjonowania — układ (fixed, odstępy) ustala `BottomBar`.
 *
 * Lewy przycisk pola: na mobile to hamburger (`NavMenu`) z całą nawigacją; na
 * desktopie zostaje ikona Bota (szybkie otwarcie/zamknięcie rozmowy z Freudem),
 * bo nawigacja jest w nagłówku.
 */
export function ComposerInput() {
  const router = useRouter();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const entries = useEntries();
  const active = useActiveContext();
  const { status, open } = useTherapistChat();
  const [enabledPref] = useTherapistEnabled();
  const session = useSession();

  // Funkcje AI (czat z Freudem, mikrofon) wyłącznie dla zalogowanych — i tylko
  // gdy rozmowa jest włączona w preferencjach. Niezalogowany nie widzi tych akcji
  // (pole służy mu wyłącznie do notatki → „Zapisz jako wpis").
  const loggedIn = Boolean(session);
  const enabled = enabledPref && loggedIn;

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
    if (!hasTherapistConsent()) {
      setOpen(true); // panel pokaże ekran zgody
      return;
    }
    const journalContext = buildJournalContext(entries);
    const uiContext = buildUiContext(active, entries);
    void sendMessage(trimmed, journalContext, uiContext);
    setText("");
  };

  // Zapisuje treść pola jako wersję roboczą i przenosi do kreatora wpisu, gdzie
  // użytkownik wybiera metryki (jak się czuje) i zatwierdza zapis.
  const saveAsEntry = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setDraft(textToHtml(trimmed));
    playSound("entry-new");
    setOpen(false);
    setText("");
    router.push("/new");
  };

  // Transkrypcja: dopisuje do pola; przy auto-send od razu wysyła do Freuda.
  const { supported, listening, transcribing, toggle } = useTranscription((t) =>
    setText((prev) => {
      const combined = prev ? `${prev} ${t}` : t;
      if (
        isAutoSend() &&
        enabled &&
        hasTherapistConsent() &&
        status !== "streaming"
      ) {
        const journalContext = buildJournalContext(entries);
        const uiContext = buildUiContext(active, entries);
        void sendMessage(combined.trim(), journalContext, uiContext);
        return "";
      }
      return combined;
    })
  );

  // Pole rośnie do ~4 wierszy (text-sm, leading-5 ≈ 20px), dalej tekst się
  // przewija. Wysokość liczymy po każdej zmianie treści.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
  }, [text]);

  const hasText = text.trim().length > 0;
  const canSendToFreud = enabled && status !== "streaming";

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Panel rozmowy z Freudem — osobny, pływa NAD paskiem. */}
      {enabled && mounted && <TherapistChat closing={closing} />}

      {/* Jeden, wspólny glass-panel: pole + (na mobile) nawigacja pod nim.
          Na desktopie panel jest przezroczysty — pole ma własną pastylkę. */}
      <div
        className={cn(
          "w-full overflow-hidden rounded-[1.75rem] border bg-background/85 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70",
          "lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:backdrop-blur-none lg:supports-[backdrop-filter]:bg-transparent"
        )}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(text);
          }}
          className={cn(
            "flex min-h-16 w-full items-center gap-1.5 px-3 py-2.5",
            "lg:rounded-[1.75rem] lg:border lg:bg-background/85 lg:shadow-lg lg:backdrop-blur lg:supports-[backdrop-filter]:bg-background/70"
          )}
        >
        {/* Mobile: hamburger → menu nawigacji (zastępuje dawną ikonę AI). */}
        <NavMenu className="lg:hidden" menuOrigin="left" />

        {/* Desktop: szybkie otwarcie/zamknięcie rozmowy z Freudem (tylko zalogowani). */}
        {loggedIn && (
          <button
            type="button"
            onClick={() => enabled && toggleOpen()}
            disabled={!enabled}
            aria-label="Rozmowa z terapeutą"
            aria-pressed={open}
            className={cn(
              "hidden size-9 shrink-0 items-center justify-center rounded-full transition-colors lg:flex",
              open ? "text-primary" : "text-muted-foreground hover:text-foreground",
              !enabled && "cursor-not-allowed opacity-50"
            )}
          >
            <Bot className="size-5" />
          </button>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => {
            // Wejście w pole = rozmowa: chowamy menu (bez planowania powrotu).
            closeMenu({ resume: false });
            if (enabled) setOpen(true);
          }}
          onKeyDown={(event) => {
            // Enter wysyła do Freuda (gdy włączony), Shift+Enter = nowy wiersz.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (enabled) submit(text);
            }
          }}
          placeholder={
            enabled
              ? "Napisz notatkę lub zapytaj Zygmunta Freuda…"
              : "Napisz notatkę…"
          }
          aria-label="Notatka lub wiadomość do terapeuty"
          className="hide-native-scroll max-h-20 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent p-0 text-sm leading-5 outline-none placeholder:text-muted-foreground"
        />

        {hasText ? (
          <>
            {/* Zapis jako wpis — dostępny zawsze, gdy jest tekst. */}
            <button
              type="button"
              onClick={() => saveAsEntry(text)}
              aria-label="Zapisz jako wpis"
              title="Zapisz jako wpis"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border text-foreground transition-transform hover:scale-105 active:scale-95"
            >
              <NotebookPen className="size-5" />
            </button>

            {/* Wyślij do Freuda — tylko dla zalogowanych; aktywne, gdy rozmowa włączona. */}
            {loggedIn && (
              <button
                type="submit"
                disabled={!canSendToFreud}
                aria-label="Wyślij do Zygmunta Freuda"
                title="Wyślij do Zygmunta Freuda"
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95",
                  !canSendToFreud &&
                    "cursor-not-allowed opacity-50 hover:scale-100"
                )}
              >
                <SendHorizontal className="size-5" />
              </button>
            )}
          </>
        ) : loggedIn ? (
          <button
            type="button"
            onClick={toggle}
            disabled={!supported || transcribing}
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
              supported
                ? transcribing
                  ? "Transkrypcja…"
                  : listening
                    ? "Zatrzymaj nagrywanie"
                    : "Nagraj notatkę głosem"
                : "Nagrywanie nie jest wspierane w tej przeglądarce"
            }
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full transition-transform",
              listening
                ? "bg-destructive text-white"
                : "bg-primary text-primary-foreground hover:scale-105 active:scale-95",
              (!supported || transcribing) &&
                "cursor-not-allowed opacity-50 hover:scale-100"
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
