"use client";

import { useSyncExternalStore } from "react";

// Reaktywny licznik otwartych lightboxów (wzorzec useSyncExternalStore, jak
// `nav-menu-store.ts`). Gdy > 0, pełnoekranowy podgląd zdjęcia przykrywa cały
// ekran — dolny pasek (kompozytor + zakładki) chowamy, żeby nie wisiał na
// wierzchu modala. Licznik zamiast boolean, bo jest odporny na podwójny montaż
// efektów w React StrictMode (setup→cleanup→setup daje netto 1).

let count = 0;

const listeners = new Set<() => void>();

let snapshot = false;

function emit(): void {
  snapshot = count > 0;
  listeners.forEach((listener) => listener());
}

export function openLightbox(): void {
  count += 1;
  emit();
}

export function closeLightbox(): void {
  count = Math.max(0, count - 1);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return snapshot;
}

/** Czy jakikolwiek pełnoekranowy podgląd zdjęcia jest otwarty. */
export function useLightboxOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
