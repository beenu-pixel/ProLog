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
let failed = false;
// Powrót z płatności: plan ustawia webhook, więc chwilę po przekierowaniu bywa stary.
let activating = false;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

async function ensureLoaded(force = false): Promise<void> {
  if (loading || (loaded && !force)) return;
  loading = true;
  try {
    const token = await getAccessToken();
    if (!token) return; // gość — funkcje płatne i tak ukryte/serwerowo blokowane
    const res = await fetch("/api/plan", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    state = (await res.json()) as PlanResponse;
    loaded = true;
    failed = false;
  } catch {
    // best-effort — brak stanu = brak blokady w UI. Nieudane odświeżenie nie kasuje
    // planu, który już znamy.
    failed = !loaded;
  } finally {
    loading = false;
    emit();
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

/** `true`, gdy planu nie udało się pobrać: `null` z `usePlan` to wtedy błąd, nie ładowanie. */
export function usePlanFailed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => failed,
    () => false
  );
}

/** Pobiera plan od nowa (ponowienie po błędzie, dopytywanie po płatności). */
export function reloadPlan(): Promise<void> {
  failed = false;
  emit();
  return ensureLoaded(true);
}

/** `true`, gdy trwa aktywacja planu po powrocie z płatności. */
export function usePlanActivating(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => activating,
    () => false
  );
}

export function setPlanActivating(next: boolean): void {
  if (activating === next) return;
  activating = next;
  emit();
}
