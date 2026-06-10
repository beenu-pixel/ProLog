import { useSyncExternalStore } from "react";

const SOUND_KEY = "prolog.soundEnabled";

const listeners = new Set<() => void>();
let storageBound = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Czy efekty dźwiękowe są włączone (domyślnie tak). */
export function isSoundEnabled(): boolean {
  if (!isBrowser()) return true;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
  } catch {
    // brak dostępu do localStorage — pomijamy
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageBound && isBrowser()) {
    window.addEventListener("storage", (e) => {
      if (e.key === SOUND_KEY) listeners.forEach((l) => l());
    });
    storageBound = true;
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Reaktywny dostęp do ustawienia dźwięku: [włączone, ustaw]. */
export function useSoundEnabled(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribe,
    isSoundEnabled,
    () => true
  );
  return [enabled, setSoundEnabled];
}
