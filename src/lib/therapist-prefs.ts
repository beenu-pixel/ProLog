"use client";

import { useSyncExternalStore } from "react";

// Preferencje czatu z terapeutą trzymane w localStorage (wzorzec jak
// `settings.ts`):
//  - consent  — jednorazowa zgoda na wysyłanie wpisów do modelu (domyślnie nie),
//  - enabled  — czy funkcja czatu jest włączona (domyślnie tak),
//  - autoSend — czy wysyłać wiadomość od razu po dyktowaniu (domyślnie nie).

const CONSENT_KEY = "prolog.therapist.consent";
const ENABLED_KEY = "prolog.therapist.enabled";
const AUTOSEND_KEY = "prolog.therapist.autoSend";

const WATCHED = [CONSENT_KEY, ENABLED_KEY, AUTOSEND_KEY];

const listeners = new Set<() => void>();
let storageBound = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function read(key: string, fallback: boolean): boolean {
  if (!isBrowser()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return fallback;
    return value === "1";
  } catch {
    return fallback;
  }
}

function write(key: string, value: boolean): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // brak dostępu do localStorage — pomijamy
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageBound && isBrowser()) {
    window.addEventListener("storage", (e) => {
      if (e.key && WATCHED.includes(e.key)) listeners.forEach((l) => l());
    });
    storageBound = true;
  }
  return () => {
    listeners.delete(listener);
  };
}

// --- Imperatywne gettery/settery (np. w handlerze wysyłki) ----------------

export function hasTherapistConsent(): boolean {
  return read(CONSENT_KEY, false);
}
export function setTherapistConsent(value: boolean): void {
  write(CONSENT_KEY, value);
}
export function isTherapistEnabled(): boolean {
  return read(ENABLED_KEY, true);
}
export function setTherapistEnabled(value: boolean): void {
  write(ENABLED_KEY, value);
}
export function isAutoSend(): boolean {
  return read(AUTOSEND_KEY, false);
}
export function setAutoSend(value: boolean): void {
  write(AUTOSEND_KEY, value);
}

// --- Reaktywne hooki -------------------------------------------------------

export function useTherapistConsent(): [boolean, (value: boolean) => void] {
  const consent = useSyncExternalStore(
    subscribe,
    () => read(CONSENT_KEY, false),
    () => false
  );
  return [consent, setTherapistConsent];
}

export function useTherapistEnabled(): [boolean, (value: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribe,
    () => read(ENABLED_KEY, true),
    () => true
  );
  return [enabled, setTherapistEnabled];
}

export function useAutoSend(): [boolean, (value: boolean) => void] {
  const autoSend = useSyncExternalStore(
    subscribe,
    () => read(AUTOSEND_KEY, false),
    () => false
  );
  return [autoSend, setAutoSend];
}
