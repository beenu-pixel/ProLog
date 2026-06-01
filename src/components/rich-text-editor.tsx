"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

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
