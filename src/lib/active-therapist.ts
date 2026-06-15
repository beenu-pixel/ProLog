"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_THERAPIST, THERAPISTS, type Therapist } from "@/lib/therapists";

// Wybór aktywnej persony terapeuty trzymany w localStorage (wzorzec jak
// `therapist-prefs.ts`). To preferencja UI — historia rozmów i tak jest osobna
// per `therapistId` (zob. `therapist-store.ts`), więc przełączenie persony
// przełącza też wątek rozmowy.

const KEY = "prolog.therapist.active";

const listeners = new Set<() => void>();
let storageBound = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isValidId(id: string | null): id is string {
  return Boolean(id) && THERAPISTS.some((t) => t.id === id);
}

function read(): string {
  if (!isBrowser()) return DEFAULT_THERAPIST.id;
  try {
    const value = window.localStorage.getItem(KEY);
    return isValidId(value) ? value : DEFAULT_THERAPIST.id;
  } catch {
    return DEFAULT_THERAPIST.id;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageBound && isBrowser()) {
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) listeners.forEach((l) => l());
    });
    storageBound = true;
  }
  return () => {
    listeners.delete(listener);
  };
}

// --- Imperatywne gettery/settery ------------------------------------------

export function getActiveTherapistId(): string {
  return read();
}

export function setActiveTherapistId(id: string): void {
  if (!isBrowser() || !isValidId(id)) return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // brak dostępu do localStorage — pomijamy
  }
  listeners.forEach((listener) => listener());
}

// --- Reaktywne hooki -------------------------------------------------------

/** Reaktywne id aktywnej persony (z fallbackiem do domyślnej). */
export function useActiveTherapistId(): string {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_THERAPIST.id);
}

/** Reaktywny obiekt aktywnej persony. */
export function useActiveTherapist(): Therapist {
  const id = useActiveTherapistId();
  return THERAPISTS.find((t) => t.id === id) ?? DEFAULT_THERAPIST;
}
