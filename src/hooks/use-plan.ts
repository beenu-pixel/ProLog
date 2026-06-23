"use client";

import { useEffect, useSyncExternalStore } from "react";

import { getAccessToken } from "@/lib/auth";
import type { PlanResponse } from "@/app/api/plan/route";

// Reaktywny store planu zalogowanego użytkownika (wzorzec jak use-ai-limits).
// Pobierany raz z GET /api/plan; pozwala UI pokazać kłódkę na funkcjach spoza
// planu (np. persony w przełączniku). Gość / brak danych => null (UI nic nie blokuje;
// twarde egzekwowanie i tak jest serwerowe).

let state: PlanResponse | null = null;
let loaded = false;
let loading = false;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

async function ensureLoaded(): Promise<void> {
  if (loaded || loading) return;
  loading = true;
  try {
    const token = await getAccessToken();
    if (!token) return; // gość — funkcje płatne i tak ukryte/serwerowo blokowane
    const res = await fetch("/api/plan", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    state = (await res.json()) as PlanResponse;
    loaded = true;
    emit();
  } catch {
    // best-effort — brak stanu = brak blokady w UI
  } finally {
    loading = false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PlanResponse | null {
  return state;
}

/**
 * Plan użytkownika i lista dozwolonych person. `null` dopóki nieznany (gość/ładowanie/
 * błąd) — wtedy UI nie blokuje niczego. Dociąga stan przy pierwszym użyciu.
 */
export function usePlan(): PlanResponse | null {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => null);

  useEffect(() => {
    void ensureLoaded();
  }, []);

  return snap;
}
