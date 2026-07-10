"use client";

import { useSyncExternalStore } from "react";

// Bieżący tekst dolnego pola (kompozytora) jako mini-store (wzorzec
// useSyncExternalStore, jak `nav-menu-store.ts`). Tekst żyje poza komponentem,
// żeby: (a) zakładka „Nowy wpis" na pasku mogła zabrać go jako wersję roboczą
// zamiast gubić pracę użytkownika, (b) treść przetrwała przełączanie tras
// (Dziennik ↔ /chat), gdzie kompozytor zmienia tylko tryb.

let text = "";

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function setComposerText(value: string): void {
  if (text === value) return;
  text = value;
  emit();
}

/** Bieżący tekst pola (poza Reactem) — np. dla zakładki „Nowy wpis". */
export function getComposerText(): string {
  return text;
}

/** Czyści pole (np. po zabraniu treści jako wersji roboczej). */
export function clearComposerText(): void {
  setComposerText("");
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reaktywny dostęp do tekstu pola. */
export function useComposerText(): string {
  return useSyncExternalStore(
    subscribe,
    () => text,
    () => ""
  );
}
