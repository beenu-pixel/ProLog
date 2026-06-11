"use client";

import { useSyncExternalStore } from "react";

// --- Aktywny kontekst widoku ----------------------------------------------
// Lekki, ulotny store (bez localStorage) trzymający informację o tym, który
// dzień / wpis użytkownik ma teraz „otwarty". Czat z terapeutą żyje w globalnym
// layoucie, więc potrzebuje tej wiedzy spoza komponentów listy/szczegółu —
// dzięki temu Freud wie, do czego odnosi się pytanie „o tym dniu".

export interface ActiveContext {
  /** Klucz dnia „YYYY-MM-DD" zaznaczonego na pasku dni (lub null). */
  openDayKey: string | null;
  /** Id konkretnie otwartego wpisu (widok szczegółu) lub null. */
  openEntryId: string | null;
}

let state: ActiveContext = { openDayKey: null, openEntryId: null };
const listeners = new Set<() => void>();

// Stała referencja dla SSR i stanu początkowego (zgodna z `state` na starcie).
const SERVER_SNAPSHOT: ActiveContext = { openDayKey: null, openEntryId: null };

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Ustawia otwarty dzień (czyści ewentualny otwarty wpis). */
export function setOpenDay(dayKey: string | null): void {
  if (state.openDayKey === dayKey && state.openEntryId === null) return;
  state = { openDayKey: dayKey, openEntryId: null };
  emit();
}

/** Ustawia otwarty wpis wraz z jego dniem (widok szczegółu). */
export function setOpenEntry(entryId: string | null, dayKey: string | null): void {
  if (state.openEntryId === entryId && state.openDayKey === dayKey) return;
  state = { openEntryId: entryId, openDayKey: dayKey };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ActiveContext {
  return state;
}

/** Imperatywny odczyt aktualnego kontekstu (np. w handlerze wysyłki). */
export function getActiveContext(): ActiveContext {
  return state;
}

/** Reaktywny dostęp do aktywnego kontekstu widoku. */
export function useActiveContext(): ActiveContext {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}
