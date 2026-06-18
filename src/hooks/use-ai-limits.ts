"use client";

import { useEffect, useSyncExternalStore } from "react";

import { getAccessToken } from "@/lib/auth";

// Reaktywny store stanu limitów AI (wzorzec useSyncExternalStore, jak
// `therapist-chat-store.ts`). Zasilany dwojako:
//   • na starcie z `GET /api/limits` (żeby wyłączyć przyciski zanim user kliknie),
//   • po każdym wywołaniu AI z nagłówków odpowiedzi (`noteFromHeaders`) — tanio,
//     bez dodatkowego zapytania.
// UI czyta przez `useAiLimit(bucket)` i dostaje `blocked` / `nearLimit` (próg 80%)
// oraz `resetAt`, by pokazać „odnowi się o północy".

export type AiBucket = "transcribe" | "therapist" | "search";

/** Stan dziennego okna jednego bucketa (lustro serwerowego RateLimitInfo). */
interface BucketState {
  limit: number;
  remaining: number;
  resetAt: string;
}

/** Próg ostrzeżenia: ostrzegamy, gdy zostało ≤ 20% puli (zużyto 80%). */
const WARN_RATIO = 0.2;

let state: Partial<Record<AiBucket, BucketState>> = {};
let loaded = false;
let loading = false;

const listeners = new Set<() => void>();

// Snapshot o stabilnej referencji — nowa powstaje tylko po realnej zmianie.
let snapshot: Partial<Record<AiBucket, BucketState>> = state;
const SERVER_SNAPSHOT: Partial<Record<AiBucket, BucketState>> = {};

function emit(): void {
  snapshot = { ...state };
  listeners.forEach((listener) => listener());
}

/** Czy `bucket` to znany klucz AI (ignorujemy `api_agent`, którego UI nie pokazuje). */
function isAiBucket(value: string): value is AiBucket {
  return value === "transcribe" || value === "therapist" || value === "search";
}

/** Pobiera bieżący stan limitów z serwera (raz; kolejne wywołania to no-op). */
async function ensureLoaded(): Promise<void> {
  if (loaded || loading) return;
  loading = true;
  try {
    const token = await getAccessToken();
    if (!token) return; // gość — funkcje AI i tak ukryte
    const res = await fetch("/api/limits", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      limits?: Record<string, BucketState>;
    };
    const next: Partial<Record<AiBucket, BucketState>> = {};
    for (const [bucket, info] of Object.entries(data.limits ?? {})) {
      if (isAiBucket(bucket) && info) {
        next[bucket] = {
          limit: info.limit,
          remaining: info.remaining,
          resetAt: info.resetAt,
        };
      }
    }
    state = next;
    loaded = true;
    emit();
  } catch {
    // best-effort — brak stanu = brak blokady w UI (serwer i tak egzekwuje twardo)
  } finally {
    loading = false;
  }
}

/**
 * Aktualizuje stan bucketa z nagłówków odpowiedzi AI (`X-RateLimit-*`). Wołane po
 * każdym `fetch` do endpointu AI — także przy 429 (nagłówki są tam obecne).
 */
export function noteFromHeaders(bucket: AiBucket, res: Response): void {
  const limit = Number(res.headers.get("X-RateLimit-Limit"));
  const remaining = Number(res.headers.get("X-RateLimit-Remaining"));
  const resetAt = res.headers.get("X-RateLimit-Reset");
  if (!resetAt || Number.isNaN(limit) || Number.isNaN(remaining)) return;
  state = { ...state, [bucket]: { limit, remaining, resetAt } };
  loaded = true;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Partial<Record<AiBucket, BucketState>> {
  return snapshot;
}

/** Wynik `useAiLimit` — gotowe flagi dla UI. */
export interface AiLimit {
  /** Pozostałe wywołania w dziennym oknie (null = nieznane / gość). */
  remaining: number | null;
  /** Dzienny limit (null = nieznane). */
  limit: number | null;
  /** Czy funkcja jest zablokowana (wyczerpany dzienny limit). */
  blocked: boolean;
  /** Czy zbliża się limit (zostało ≤ 20% puli, ale jeszcze > 0). */
  nearLimit: boolean;
  /** ISO północy, kiedy limit się odnowi (null = nieznane). */
  resetAt: string | null;
}

/**
 * Reaktywny stan limitu danej funkcji AI. Przy pierwszym użyciu dociąga stan z
 * serwera. Gdy stan nieznany (gość / błąd) — nic nie blokuje (`blocked: false`).
 */
export function useAiLimit(bucket: AiBucket): AiLimit {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  useEffect(() => {
    void ensureLoaded();
  }, []);

  const info = snap[bucket];
  if (!info) {
    return { remaining: null, limit: null, blocked: false, nearLimit: false, resetAt: null };
  }
  return {
    remaining: info.remaining,
    limit: info.limit,
    blocked: info.remaining <= 0,
    nearLimit: info.remaining > 0 && info.remaining <= info.limit * WARN_RATIO,
    resetAt: info.resetAt,
  };
}
