"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Mic, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranscription } from "@/hooks/use-transcription";

/**
 * Pływający „kompozytor" — przyszłe miejsce komunikacji z AI / tworzenia wpisu.
 * Widoczny globalnie (poza ekranem powitalnym). Na razie warstwa wizualna: pole
 * tekstu (nic nie zapisuje) + spinacz (dekoracyjny). Działa wyłącznie mikrofon:
 * nagranie głosu (transkrypcja przez Groq) dopisuje transkrypt do pola.
 *
 * Pozycja jest responsywna, by nie nachodzić na `BottomNav`: na mobile, gdy nav
 * jest widoczny (poza /new i /edit), pasek siedzi nad nim; gdy nav się chowa
 * (formularze) — niżej; na desktopie nav i tak jest ukryty.
 */
export function ComposerBar() {
  const pathname = usePathname();
  const [text, setText] = useState("");
  const { supported, listening, transcribing, toggle } = useTranscription((t) =>
    setText((prev) => (prev ? `${prev} ${t}` : t))
  );

  // Ekran powitalny ma własny układ — bez kompozytora.
  if (pathname === "/welcome") return null;

  // Na tych trasach `BottomNav` się chowa, więc pasek może zejść niżej.
  const isForm = pathname === "/new" || pathname.endsWith("/edit");

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 flex justify-center px-4 lg:bottom-6",
        isForm ? "bottom-5" : "bottom-24"
      )}
    >
      <div className="flex h-16 w-full max-w-md items-center gap-1.5 rounded-full border bg-background/85 px-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:max-w-2xl">
        <button
          type="button"
          aria-label="Załącznik"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <Paperclip className="size-5" />
        </button>

        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Napisz wpis lub zapytaj AI…"
          aria-label="Wiadomość"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

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
            (!supported || transcribing) && "cursor-not-allowed opacity-50 hover:scale-100"
          )}
        >
          {transcribing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Mic className={cn("size-5", listening && "animate-pulse")} />
          )}
        </button>
      </div>
    </div>
  );
}
