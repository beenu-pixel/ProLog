"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoodSlider } from "@/components/mood-slider";
import { RichTextEditor } from "@/components/rich-text-editor";
import { METRICS } from "@/lib/metrics";
import { addEntry, updateEntry } from "@/lib/storage";
import { playSound } from "@/lib/sound";
import type { Entry, MetricKey, Scale } from "@/lib/types";

interface EntryFormProps {
  /** Wpis do edycji. Brak = tryb dodawania nowego wpisu. */
  entry?: Entry;
}

export function EntryForm({ entry }: EntryFormProps) {
  const router = useRouter();
  const isEdit = Boolean(entry);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  // Suwak zawsze ma wartość 1–5 — brakujące metryki (np. starsze wpisy)
  // startują od „3" (neutralnie).
  const [values, setValues] = useState<Record<MetricKey, Scale>>(() => {
    const init = {} as Record<MetricKey, Scale>;
    for (const metric of METRICS) {
      init[metric.key] = (entry?.[metric.key] ?? 3) as Scale;
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Podaj tytuł wpisu.");
      return;
    }

    const input = { title: title.trim(), content, ...values };

    if (isEdit && entry) {
      updateEntry(entry.id, input);
      playSound("entry-save");
      router.push(`/entries/${entry.id}`);
    } else {
      const created = addEntry(input);
      playSound("entry-save");
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

      <div className="space-y-5">
        <Label>Metryki dnia</Label>
        <div className="space-y-5">
          {METRICS.map((metric) => (
            <div key={metric.key} className="space-y-2">
              <Label className="font-normal text-muted-foreground">
                {metric.label} —{" "}
                <span className="text-foreground">
                  {metric.levels[values[metric.key] - 1]}
                </span>
              </Label>
              <MoodSlider
                value={values[metric.key]}
                levels={metric.levels}
                label={metric.label}
                onChange={(value) =>
                  setValues((prev) => ({ ...prev, [metric.key]: value }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Anuluj
        </Button>
        <Button type="submit">Zapisz</Button>
      </div>
    </form>
  );
}
