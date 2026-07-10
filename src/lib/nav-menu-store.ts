"use client";

import { useSyncExternalStore } from "react";

// Reaktywny store stanu menu nawigacji (wzorzec useSyncExternalStore, jak
// `therapist-chat-store.ts`). Panel Freuda jest desktop-only, a menu mobile-only,
// więc nie ma już wzajemnego wykluczania — store trzyma tylko stan otwarcia.

interface NavMenuState {
  open: boolean;
}

let open = false;

const listeners = new Set<() => void>();

let snapshot: NavMenuState = { open };
const SERVER_SNAPSHOT: NavMenuState = { open: false };

function emit(): void {
  snapshot = { open };
  listeners.forEach((listener) => listener());
}

export function openMenu(): void {
  if (open) return;
  open = true;
  emit();
}

export function closeMenu(): void {
  if (!open) return;
  open = false;
  emit();
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
