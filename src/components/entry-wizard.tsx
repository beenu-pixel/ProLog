"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScalePicker } from "@/components/scale-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  PhotoAddButton,
  PhotoField,
  type PhotoFieldHandle,
} from "@/components/photo-field";
import { METRICS, METRIC_BY_KEY } from "@/lib/metrics";
import { addEntry } from "@/lib/storage";
import { deletePhotos } from "@/lib/photos";
import { deriveTitle } from "@/lib/api-entry";
import {
  canSaveEntry,
  htmlHasText,
  resolveTitle,
  SAVE_BLOCK_MESSAGE,
} from "@/lib/entry-validation";
import { takeDraft } from "@/lib/entry-draft";
import { playSound } from "@/lib/sound";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { EntryPhoto, MetricKey, Scale } from "@/lib/types";

const TOTAL = METRICS.length + 1; // 5 metryk + ekran notatki

/**
 * Kreator nowego wpisu krok-po-kroku (styl Stoic): kolejne ekrany metryk
 * (wybór 1–5 przyciskami), a na końcu ekran z tytułem i treścią. Stan trzymany
 * lokalnie; zapis dopiero na ostatnim kroku.
 */
export function EntryWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Partial<Record<MetricKey, Scale>>>({});
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<EntryPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = Boolean(useSession());
  const photoFieldRef = useRef<PhotoFieldHandle>(null);
  // Sprzątanie sierot: ścieżki wgrane w tej sesji. Gdy wpis nie zostanie
  // zapisany (powrót/zamknięcie), kasujemy je ze Storage.
  const uploadedPaths = useRef<string[]>([]);
  const saved = useRef(false);

  useEffect(() => {
    // Celowo czytamy najświeższą wartość refów przy odmontowaniu (nie w chwili
    // uruchomienia efektu) — chcemy listę uploadów z momentu opuszczenia ekranu.
    return () => {
      if (!saved.current && uploadedPaths.current.length > 0) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        void deletePhotos(uploadedPaths.current);
      }
    };
  }, []);

  // Wersja robocza z dolnego paska („Zapisz jako wpis"): jeśli istnieje,
  // wstawiamy treść i wnioskowany tytuł, więc kreator zaczyna od metryk, a
  // gotową notatkę użytkownik tylko przegląda na ostatnim kroku.
  useEffect(() => {
    const draft = takeDraft();
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jednorazowe wciągnięcie wersji roboczej z sessionStorage (niedostępnej podczas renderu SSR)
      setContent(draft);
      setTitle(deriveTitle(draft));
    }
  }, []);

  // Auto-przejście po wyborze wartości — z krótką zwłoką, by pokazać zaznaczenie.
  const advanceTimer = useRef<number | null>(null);
  const clearTimer = () => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const isNote = step === METRICS.length;
  const metric = isNote ? null : METRICS[step];

  const goBack = () => {
    clearTimer();
    if (step === 0) {
      router.push("/entries");
      return;
    }
    setStep((s) => s - 1);
  };

  const goNext = () => {
    clearTimer();
    setStep((s) => Math.min(TOTAL - 1, s + 1));
  };

  const pick = (key: MetricKey, value: Scale) => {
    clearTimer();
    setValues((prev) => ({ ...prev, [key]: value }));
    advanceTimer.current = window.setTimeout(() => {
      setStep((s) => (s < METRICS.length ? s + 1 : s));
    }, 220);
  };

  const save = () => {
    clearTimer();
    // Wpis musi nieść tekst (tytuł/treść) — albo zdjęcie z nastrojem.
    const check = canSaveEntry({
      title,
      content,
      photoCount: photos.length,
      metricCount: Object.keys(values).length,
    });
    if (!check.ok) {
      setError(SAVE_BLOCK_MESSAGE[check.reason!]);
      return;
    }
    saved.current = true;
    const finalTitle = resolveTitle({ title, content, photoCount: photos.length });
    const created = addEntry({ title: finalTitle, content, photos, ...values });
    playSound("entry-save");
    router.push(`/entries/${created.id}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-6">
      {/* Pasek górny: powrót + postęp. */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label={step === 0 ? "Wróć do listy" : "Poprzedni krok"}
          onClick={goBack}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <div className="mb-1 text-xs text-muted-foreground">
            Krok {step + 1} z {TOTAL}
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300"
              style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Treść kroku. */}
      <div className="flex flex-1 flex-col justify-center py-8">
        {metric ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              {metric.prompt}
            </h1>
            <ScalePicker
              value={values[metric.key]}
              onChange={(value) => pick(metric.key, value)}
              levels={metric.levels}
              ariaLabel={metric.label}
            />
            <div
              className={cn(
                "flex items-center",
                step === 0 ? "justify-end" : "justify-between"
              )}
            >
              {step > 0 && (
                <Button variant="ghost" onClick={goBack}>
                  Wstecz
                </Button>
              )}
              <Button variant="ghost" className="text-muted-foreground" onClick={goNext}>
                Pomiń
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Twój wpis</h1>
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
                    <PhotoAddButton
                      onClick={() => photoFieldRef.current?.open()}
                    />
                  ) : undefined
                }
              />
              {loggedIn && (
                <PhotoField
                  ref={photoFieldRef}
                  photos={photos}
                  onChange={setPhotos}
                  onUploaded={(photo) =>
                    uploadedPaths.current.push(photo.path)
                  }
                />
              )}
            </div>

            {/* Wpis bez tekstu, ale ze zdjęciem, wymaga nastroju — pozwalamy go
                ustawić tu, bez cofania kroków. Znika, gdy pojawi się tekst. */}
            {photos.length > 0 &&
              !(title.trim() !== "" || htmlHasText(content)) && (
                <div className="space-y-2">
                  <Label>{METRIC_BY_KEY.mood.prompt}</Label>
                  <p className="text-xs text-muted-foreground">
                    Wymagane przy wpisie bez tekstu.
                  </p>
                  <ScalePicker
                    value={values.mood}
                    onChange={(value) => {
                      setValues((prev) => ({ ...prev, mood: value }));
                      if (error) setError(null);
                    }}
                    levels={METRIC_BY_KEY.mood.levels}
                    ariaLabel={METRIC_BY_KEY.mood.label}
                    size="sm"
                  />
                </div>
              )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={goBack}>
                Wstecz
              </Button>
              <Button onClick={save}>Zapisz</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
