"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOOD_LABELS } from "@/components/mood-dots";
import { MoodSlider } from "@/components/mood-slider";
import { RichTextEditor } from "@/components/rich-text-editor";
import { addEntry, updateEntry } from "@/lib/storage";
import type { Entry, Mood } from "@/lib/types";

interface EntryFormProps {
  /** Wpis do edycji. Brak = tryb dodawania nowego wpisu. */
  entry?: Entry;
}

export function EntryForm({ entry }: EntryFormProps) {
  const router = useRouter();
  const isEdit = Boolean(entry);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [mood, setMood] = useState<Mood>(entry?.mood ?? 3);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Podaj tytuł wpisu.");
      return;
    }

    const input = { title: title.trim(), content, mood };

    if (isEdit && entry) {
      updateEntry(entry.id, input);
      router.push(`/entries/${entry.id}`);
    } else {
      const created = addEntry(input);
      router.push(`/entries/${created.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Tytuł</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Tytuł wpisu"
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="space-y-2">
        <Label>Treść</Label>
        <RichTextEditor value={content} onChange={setContent} />
      </div>

      <div className="space-y-3">
        <Label>Nastrój — {MOOD_LABELS[mood]}</Label>
        <MoodSlider value={mood} onChange={setMood} />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
        >
          Anuluj
        </Button>
        <Button type="submit">Zapisz</Button>
      </div>
    </form>
  );
}
