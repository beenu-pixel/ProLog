import { useSyncExternalStore } from "react";

// Wynik wymiany wpisów z chmurą. Zapis lokalny działa niezależnie, ale użytkownik
// ma wiedzieć, że wpis nie dotarł na serwer albo że lista może być niepełna.

export type SyncIssue = "pull" | "push" | null;

let pullFailed = false;
let pushFailed = false;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function setPullFailed(next: boolean): void {
  if (pullFailed === next) return;
  pullFailed = next;
  emit();
}

export function setPushFailed(next: boolean): void {
  if (pushFailed === next) return;
  pushFailed = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getIssue(): SyncIssue {
  if (pullFailed) return "pull";
  return pushFailed ? "push" : null;
}

/** Bieżący problem z chmurą: brak pobrania ma pierwszeństwo przed brakiem wysyłki. */
export function useSyncIssue(): SyncIssue {
  return useSyncExternalStore(subscribe, getIssue, () => null);
}
