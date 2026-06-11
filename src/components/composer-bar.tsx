"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, Mic, SendHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranscription } from "@/hooks/use-transcription";
import { useEntries } from "@/hooks/use-entries";
import { useActiveContext } from "@/lib/active-context";
import { buildJournalContext, buildUiContext } from "@/lib/therapist-context";
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

/**
 * Pływający „kompozytor" — wejście do rozmowy z cyfrowym terapeutą (Freud).
 * Klik w pole lub w ikonę otwiera panel rozmowy nad paskiem. Pole tekstu wysyła
 * wiadomość; mikrofon dyktuje (transkrypcja Groq) i — przy włączonym auto-send —
 * od razu wysyła. Widoczny globalnie poza ekranem powitalnym.
 *
 * Pozycja jest responsywna, by nie nachodzić na `BottomNav`: na mobile, gdy nav
 * jest widoczny (poza /new i /edit), pasek siedzi nad nim; gdy nav się chowa
 * (formularze) — niżej; na desktopie nav i tak jest ukryty.
 */
export function ComposerBar() {
  const pathname = usePathname();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const entries = useEntries();
  const active = useActiveContext();
  const { status, open } = useTherapistChat();
  const [enabled] = useTherapistEnabled();

  // Panel trzymamy zamontowany przez czas animacji wyjścia: gdy `open` schodzi
  // do false, najpierw odtwarzamy animację (`closing`), a dopiero po niej
  // odmontowujemy. Otwarcie w trakcie zamykania (cleanup) anuluje odmontowanie.
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
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

  // Transkrypcja: dopisuje do pola; przy auto-send od razu wysyła.
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

  // Ekran powitalny i Ustawienia mają własny układ — bez kompozytora/czatu.
  if (pathname === "/welcome" || pathname === "/settings") return null;

  // Na tych trasach `BottomNav` się chowa, więc pasek może zejść niżej.
  const isForm = pathname === "/new" || pathname.endsWith("/edit");
  const showSend = enabled && text.trim().length > 0;

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 flex justify-center px-4 lg:bottom-6",
        isForm ? "bottom-5" : "bottom-24"
      )}
    >
      <div className="flex w-full max-w-md flex-col gap-2 lg:max-w-2xl">
        {enabled && mounted && <TherapistChat closing={closing} />}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(text);
          }}
          className="flex min-h-16 w-full items-center gap-1.5 rounded-[1.75rem] border bg-background/85 px-3 py-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70"
        >
          <button
            type="button"
            onClick={() => enabled && toggleOpen()}
            disabled={!enabled}
            aria-label="Rozmowa z terapeutą"
            aria-pressed={open}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
              open ? "text-primary" : "text-muted-foreground hover:text-foreground",
              !enabled && "cursor-not-allowed opacity-50"
            )}
          >
            <Bot className="size-5" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => enabled && setOpen(true)}
            onKeyDown={(event) => {
              // Enter wysyła, Shift+Enter dodaje nowy wiersz.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(text);
              }
            }}
            disabled={!enabled}
            placeholder={
              enabled
                ? "Napisz lub zapytaj Zygmunta Freuda…"
                : "Rozmowa z terapeutą jest wyłączona"
            }
            aria-label="Wiadomość do terapeuty"
            className="hide-native-scroll max-h-20 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent p-0 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />

          {showSend ? (
            <button
              type="submit"
              disabled={status === "streaming"}
              aria-label="Wyślij"
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95",
                status === "streaming" &&
                  "cursor-not-allowed opacity-50 hover:scale-100"
              )}
            >
              <SendHorizontal className="size-5" />
            </button>
          ) : (
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
                      : "Nagraj głos"
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
          )}
        </form>
      </div>
    </div>
  );
}
