"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

// Wspólny stan „trwa przejście na inną stronę” dla paska ładowania u góry
// (`TapFeedback`). Zgłaszają go dwa źródła: stuknięcie w link (TapFeedback sam
// łapie kliknięcia) i przejście z kodu (`router.push` po zapisie wpisu itp.),
// którego żaden link nie poprzedza. Pasek gaśnie, gdy zmieni się ścieżka.

let pendingFrom: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Zaczyna przejście z bieżącej ścieżki (no-op, gdy cel to ta sama strona). */
export function startNavigation(href?: string): void {
  if (typeof window === "undefined") return;
  if (href) {
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin) return;
    if (target.pathname === window.location.pathname) return;
  }
  pendingFrom = window.location.pathname;
  emit();
}

export function endNavigation(): void {
  if (pendingFrom === null) return;
  pendingFrom = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ścieżka, z której trwa przejście, albo `null`. */
export function useNavigationFrom(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => pendingFrom,
    () => null
  );
}

/**
 * `useRouter` z paskiem ładowania: `push` i `replace` zgłaszają przejście, zanim
 * oddadzą je Next.js. Używać tam, gdzie nawigację wywołuje kod, a nie link.
 */
export function useProgressRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => {
        startNavigation(href);
        router.push(href, options);
      },
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
        startNavigation(href);
        router.replace(href, options);
      },
    }),
    [router]
  );
}
