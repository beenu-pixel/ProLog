import { useSyncExternalStore } from "react";

// Preferencja „Animacje interfejsu" trzymana w localStorage (wzorzec jak
// `settings.ts`). Domyślnie włączone. Gdy wyłączone, `AppShell` nakłada klasę
// `no-anim` na <html>, a `globals.css` zeruje animacje/przejścia CSS oraz
// crossfade motywu (View Transitions).

const MOTION_KEY = "prolog.animationsEnabled";

const listeners = new Set<() => void>();
let storageBound = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Czy animacje interfejsu są włączone (domyślnie tak). */
export function isAnimationsEnabled(): boolean {
  if (!isBrowser()) return true;
  try {
    return window.localStorage.getItem(MOTION_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAnimationsEnabled(enabled: boolean): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(MOTION_KEY, enabled ? "1" : "0");
  } catch {
    // brak dostępu do localStorage — pomijamy
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageBound && isBrowser()) {
    window.addEventListener("storage", (e) => {
      if (e.key === MOTION_KEY) listeners.forEach((l) => l());
    });
    storageBound = true;
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Reaktywny dostęp do ustawienia animacji: [włączone, ustaw]. */
export function useAnimationsEnabled(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, isAnimationsEnabled, () => true);
  return [enabled, setAnimationsEnabled];
}
