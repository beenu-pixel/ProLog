"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Mic } from "lucide-react";

import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// --- Dyktowanie (Web Speech API) -----------------------------------------
// Typy mowy nie są w standardowym lib.dom, więc definiujemy minimalny kontrakt.
type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

function DictateButton({ editor }: { editor: Editor }) {
  // Wsparcie dla Web Speech API czytamy jak useHydrated — bez setState w efekcie
  // i bez niezgodności hydratacji (serwer: false, klient po hydratacji: realne).
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => getRecognitionCtor() !== null,
    () => false
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "pl-PL";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) text += result[0].transcript;
      }
      const trimmed = text.trim();
      if (trimmed) {
        editor.chain().focus().insertContent(`${trimmed} `).run();
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        // recognition mógł nie być uruchomiony — pomijamy.
      }
      recognitionRef.current = null;
    };
  }, [editor]);

  const toggle = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() rzuca, gdy rozpoznawanie już trwa — pomijamy.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!supported}
      aria-pressed={listening}
      aria-label="Dyktuj"
      title={
        supported
          ? listening
            ? "Zatrzymaj dyktowanie"
            : "Dyktuj"
          : "Dyktowanie nie jest wspierane w tej przeglądarce"
      }
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md px-2 text-sm transition-colors",
        listening
          ? "bg-destructive/10 text-destructive"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        !supported && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground"
      )}
    >
      <Mic className={cn("size-4", listening && "animate-pulse")} />
      <span>Dyktuj</span>
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5">
      <ToolbarButton
        label="Pogrubienie"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Kursywa"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Lista punktowana"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerowana"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      {/* Pionowy divider oddzielający formatowanie od dyktowania. */}
      <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />

      <DictateButton editor={editor} />
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Co chodzi Ci po głowie?",
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose-editor min-h-40 px-3 py-2 outline-none text-base leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // TipTap zwraca "<p></p>" dla pustej treści — normalizujemy do pustego stringa.
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  if (!editor) {
    return (
      <div className="min-h-48 rounded-md border bg-transparent" aria-hidden />
    );
  }

  return (
    <div className="rounded-md border bg-transparent focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
