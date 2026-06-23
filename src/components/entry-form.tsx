"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoodSlider } from "@/components/mood-slider";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  PhotoAddButton,
  PhotoField,
  type PhotoFieldHandle,
} from "@/components/photo-field";
import { METRICS } from "@/lib/metrics";
import { addEntry, updateEntry, unreferencedPhotoPaths } from "@/lib/storage";
import { deletePhotos } from "@/lib/photos";
import { canSaveEntry, resolveTitle, SAVE_BLOCK_MESSAGE } from "@/lib/entry-validation";
import { playSound } from "@/lib/sound";
import { useSession } from "@/lib/auth";
import type { Entry, EntryPhoto, MetricKey, Scale } from "@/lib/types";

interface EntryFormProps {
  /** Wpis do edycji. Brak = tryb dodawania nowego wpisu. */
  entry?: Entry;
}

export function EntryForm({ entry }: EntryFormProps) {
  const router = useRouter();
  const isEdit = Boolean(entry);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [photos, setPhotos] = useState<EntryPhoto[]>(entry?.photos ?? []);

  const loggedIn = Boolean(useSession());
  const photoFieldRef = useRef<PhotoFieldHandle>(null);
  // Ścieżki obecne na wejściu (po zapisie kasujemy te usunięte; przy anulowaniu
  // kasujemy tylko nowe, wgrane w tej sesji).
  const originalPaths = useRef<string[]>(
    (entry?.photos ?? []).map((p) => p.path)
  );
  const uploadedPaths = useRef<string[]>([]);
  const saved = useRef(false);

  useEffect(() => {
    // Celowo czytamy najświeższą wartość refów przy odmontowaniu (Anuluj/wyjście):
    // chcemy listę uploadów z momentu opuszczenia formularza, nie z chwili montażu.
    /* eslint-disable react-hooks/exhaustive-deps */
    return () => {
      if (saved.current) return;
      const uploaded = uploadedPaths.current;
      const original = originalPaths.current;
      const orphans = uploaded.filter((p) => !original.includes(p));
      if (orphans.length > 0) void deletePhotos(orphans);
    };
    /* eslint-enable react-hooks/exhaustive-deps */
  }, []);
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
    const check = canSaveEntry({
      title,
      content,
      photoCount: photos.length,
      metricCount: Object.values(values).length,
    });
    if (!check.ok) {
      setError(SAVE_BLOCK_MESSAGE[check.reason!]);
      return;
    }

    const finalTitle = resolveTitle({ title, content, photoCount: photos.length });
    const input = { title: finalTitle, content, photos, ...values };
    saved.current = true;

    const currentPaths = photos.map((p) => p.path);
    const removed = originalPaths.current.filter(
      (p) => !currentPaths.includes(p)
    );

    if (isEdit && entry) {
      // Najpierw zapis (wpis przestaje referować usunięte ścieżki), potem
      // sprzątanie — kasujemy tylko pliki nieużywane przez żaden inny wpis,
      // by nie usunąć zdjęcia współdzielonego (np. album i pojedynczy dzień).
      updateEntry(entry.id, input);
      if (removed.length > 0) {
        const orphaned = unreferencedPhotoPaths(removed);
        if (orphaned.length > 0) void deletePhotos(orphaned);
      }
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
        <RichTextEditor
          value={content}
          onChange={setContent}
          toolbarExtra={
            loggedIn ? (
              <PhotoAddButton onClick={() => photoFieldRef.current?.open()} />
            ) : undefined
          }
        />
        {loggedIn && (
          <PhotoField
            ref={photoFieldRef}
            photos={photos}
            onChange={setPhotos}
            onUploaded={(photo) => uploadedPaths.current.push(photo.path)}
          />
        )}
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
