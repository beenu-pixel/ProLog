"use client";

import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { type Therapist } from "@/lib/therapists";
import type { ChatMessage } from "@/lib/therapist-store";

// Elementy rozmowy z cyfrowym terapeutą wspólne dla ekranu `/chat`
// (`ChatScreen`): zgoda na wysyłanie wpisów i dymki wiadomości. Rozmowa jest
// ekranem (pasek boczny → „Rozmowa”), a nie pływającym panelem nad polem.

/** Jednorazowa zgoda na wysyłanie wpisów do modelu AI. */
export function ConsentGate({
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
        className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Rozumiem, zaczynamy
      </button>
    </div>
  );
}

/** Pojedynczy dymek. Asystent: lekki markdown; pusty + streaming → kropki. */
export function Bubble({ message }: { message: ChatMessage }) {
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
