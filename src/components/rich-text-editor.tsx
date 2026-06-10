"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Loader2, Mic } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranscription } from "@/hooks/use-transcription";

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

function DictateButton({ editor }: { editor: Editor }) {
  const { supported, listening, transcribing, toggle } = useTranscription(
    (text) => {
      editor.chain().focus().insertContent(`${text} `).run();
    }
  );

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!supported || transcribing}
      aria-pressed={listening}
      aria-busy={transcribing}
      aria-label="Dyktuj"
      title={
        supported
          ? transcribing
            ? "Transkrypcja…"
            : listening
              ? "Zatrzymaj nagrywanie"
              : "Dyktuj"
          : "Nagrywanie nie jest wspierane w tej przeglądarce"
      }
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md px-2 text-sm transition-colors",
        listening
          ? "bg-destructive/10 text-destructive"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        (!supported || transcribing) &&
          "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground"
      )}
    >
      {transcribing ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Mic className={cn("size-4", listening && "animate-pulse")} />
      )}
      <span>{transcribing ? "Transkrypcja…" : "Dyktuj"}</span>
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
    <div className="rounded-md border bg-transparent transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
