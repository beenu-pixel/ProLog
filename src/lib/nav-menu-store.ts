"use client";

import { useSyncExternalStore } from "react";

import {
  setOpen as setTherapistOpen,
  isOpen as isTherapistOpen,
} from "@/lib/therapist-chat-store";

// Reaktywny store stanu menu nawigacji (wzorzec useSyncExternalStore, jak
// `therapist-chat-store.ts`). Wynika z koordynacji na mobile: menu (hamburger)
// i panel Freuda są zakotwiczone nad dolnym paskiem i nie mogą być otwarte
// jednocześnie. Logikę wykluczania trzymamy tutaj (import jednokierunkowy do
// store'a Freuda), więc store Freuda nie musi nic wiedzieć o menu.

interface NavMenuState {
  open: boolean;
}

let open = false;
// Czy po zamknięciu menu wrócić do rozmowy z Freudem (gdy był otwarty tuż przed
// otwarciem menu). Zerowane przy każdym zamknięciu.
let resumeFreud = false;

const listeners = new Set<() => void>();

let snapshot: NavMenuState = { open };
const SERVER_SNAPSHOT: NavMenuState = { open: false };

function emit(): void {
  snapshot = { open };
  listeners.forEach((listener) => listener());
}

export function openMenu(): void {
  if (open) return;
  // Otwarcie menu chowa Freuda; zapamiętujemy, czy był otwarty, by wrócić po zamknięciu.
  resumeFreud = isTherapistOpen();
  setTherapistOpen(false);
  open = true;
  emit();
}

/**
 * Zamknięcie menu. Domyślnie przywraca Freuda, jeśli był otwarty przed otwarciem
 * menu (X / backdrop / Escape = „wracam do rozmowy"). `resume: false` pomija
 * powrót — używane przy nawigacji (wybór pozycji menu, zmiana trasy).
 */
export function closeMenu(opts?: { resume?: boolean }): void {
  if (!open) return;
  open = false;
  const resume = opts?.resume !== false && resumeFreud;
  resumeFreud = false;
  emit();
  if (resume) setTherapistOpen(true);
}

export function toggleMenu(): void {
  if (open) closeMenu();
  else openMenu();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): NavMenuState {
  return snapshot;
}

/** Reaktywny dostęp do stanu menu. */
export function useNavMenu(): NavMenuState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}
