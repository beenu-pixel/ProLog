"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScalePicker } from "@/components/scale-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { METRICS } from "@/lib/metrics";
import { addEntry } from "@/lib/storage";
import { deriveTitle } from "@/lib/api-entry";
import { takeDraft } from "@/lib/entry-draft";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { MetricKey, Scale } from "@/lib/types";

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
  const [error, setError] = useState<string | null>(null);

  // Wersja robocza z dolnego paska („Zapisz jako wpis"): jeśli istnieje,
  // wstawiamy treść i wnioskowany tytuł, więc kreator zaczyna od metryk, a
  // gotową notatkę użytkownik tylko przegląda na ostatnim kroku.
  useEffect(() => {
    const draft = takeDraft();
    if (draft) {
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
    if (!title.trim()) {
      setError("Podaj tytuł wpisu.");
      return;
    }
    const created = addEntry({ title: title.trim(), content, ...values });
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
              <RichTextEditor value={content} onChange={setContent} />
            </div>
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
