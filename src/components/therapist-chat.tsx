"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { CustomScroll } from "@/components/custom-scroll";
import { type Therapist } from "@/lib/therapists";
import { useActiveTherapist } from "@/lib/active-therapist";
import { setOpen, useTherapistChat } from "@/lib/therapist-chat-store";
import { TherapistSwitcher } from "@/components/therapist-switcher";
import { useTherapistConsent } from "@/lib/therapist-prefs";
import type { ChatMessage } from "@/lib/therapist-store";

/**
 * Rozwijane okno rozmowy z cyfrowym terapeutą (Freud). Renderowane przez
 * `ComposerBar` tuż nad paskiem, gdy panel jest otwarty. Pole tekstu i mikrofon
 * pozostają w `ComposerBar` poniżej — tutaj jest sama rozmowa.
 */
export function TherapistChat({ closing = false }: { closing?: boolean }) {
  const { messages, status } = useTherapistChat();
  const active = useActiveTherapist();
  const [consent, setConsent] = useTherapistConsent();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll na dół przy nowych wiadomościach / strumieniu.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status, consent]);

  return (
    <div
      className={cn(
        "flex max-h-[60vh] w-full flex-col overflow-hidden rounded-3xl border bg-background/95 shadow-xl backdrop-blur ease-out supports-[backdrop-filter]:bg-background/80 motion-reduce:animate-none",
        closing
          ? "duration-200 animate-out fade-out slide-out-to-bottom-4"
          : "duration-300 animate-in fade-in slide-in-from-bottom-4"
      )}
    >

      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center">
          {/* Mobile: przełącznik persony (rozwijana lista w nagłówku). */}
          <TherapistSwitcher
            variant="title"
            placement="down"
            className="lg:hidden"
          />
          {/* Desktop: tożsamość statyczna — przełącznik jest w pasku pola (pigułka). */}
          <div className="hidden flex-col lg:flex">
            <p className="text-sm font-semibold">{active.name}</p>
            <p className="text-xs text-muted-foreground">{active.title}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Zwiń rozmowę"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      {!consent ? (
        <ConsentGate therapist={active} onAccept={() => setConsent(true)} />
      ) : (
        <CustomScroll
          innerRef={scrollRef}
          contentClassName="max-h-[50vh] min-h-[7rem] px-4 py-4"
          thumbRight={6}
        >
          <div className="min-h-full space-y-3">
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
          </div>
        </CustomScroll>
      )}
    </div>
  );
}

/** Jednorazowa zgoda na wysyłanie wpisów do modelu AI. */
function ConsentGate({
  therapist,
  onAccept,
}: {
  therapist: Therapist;
  onAccept: () => void;
}) {
  return (
    <div className="space-y-3 px-4 py-5 text-sm">
      <p className="font-medium">Zanim zaczniemy rozmowę</p>
      <p className="text-muted-foreground">
        Aby {therapist.name} mógł analizować Twój dziennik, treść Twoich
        wpisów będzie wysyłana do modelu AI (xAI) w celu wygenerowania odpowiedzi.
        Rozmowy zapisujemy prywatnie — możesz je w każdej chwili wyczyścić w
        Ustawieniach.
      </p>
      <button
        type="button"
        onClick={onAccept}
        className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95"
      >
        Rozumiem, zaczynamy
      </button>
    </div>
  );
}

/** Pojedynczy dymek. Asystent: lekki markdown; pusty + streaming → kropki. */
function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const empty = message.content.length === 0;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        {empty ? <TypingDots /> : renderMarkdown(message.content)}
      </div>
    </div>
  );
}

/** Trzy pulsujące kropki — „terapeuta pisze…". */
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Terapeuta pisze…">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-current opacity-60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

// --- Minimalny, bezpieczny render markdownu --------------------------------
// Obsługujemy tylko **pogrubienie** i *kursywę*/_kursywę_ oraz złamania linii.
// Tekst trafia jako węzły Reacta (bez dangerouslySetInnerHTML) — brak ryzyka XSS.

const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>);
    } else {
      nodes.push(<em key={key++}>{match[2] ?? match[3]}</em>);
    }
    lastIndex = INLINE.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <Fragment key={i}>
      {renderInline(line)}
      {i < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}
