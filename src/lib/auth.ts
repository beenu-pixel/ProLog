"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase, isConfigured } from "@/lib/supabase";
import { getEntries, mergeRemoteEntries, clearEntries } from "@/lib/storage";
import { pushAll, pullAll } from "@/lib/sync";

// --- Współdzielony store sesji --------------------------------------------
// Pojedyncza subskrypcja `onAuthStateChange` dla całej aplikacji (useSession
// jest wołane przez wiele komponentów). Dzięki temu mamy jeden nasłuchiwacz i
// dokładnie jeden `pushAll` na zdarzenie logowania, a nie po jednym na komponent.

let currentSession: Session | null = null;
const sessionListeners = new Set<() => void>();
let authInitialized = false;
// Id użytkownika, dla którego już wykonaliśmy hydratację z chmury — by zrobić ją
// raz na sesję, a nie przy każdym odświeżeniu tokenu (`TOKEN_REFRESHED`).
let hydratedUserId: string | null = null;

function emitSession(): void {
  sessionListeners.forEach((listener) => listener());
}

function initAuth(): void {
  if (authInitialized || !isConfigured || !supabase) return;
  authInitialized = true;

  supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session;
    emitSession();
  });

  supabase.auth.onAuthStateChange((event, next) => {
    currentSession = next;
    emitSession();

    // Wylogowanie: czyścimy lokalny widok, by na współdzielonym urządzeniu nie
    // zostały cudze wpisy. Tylko na realne `SIGNED_OUT` — NIE na `INITIAL_SESSION`
    // z pustą sesją (to zwykłe wejście niezalogowanego, którego lokalnych wpisów
    // nie wolno kasować).
    if (event === "SIGNED_OUT") {
      hydratedUserId = null;
      clearEntries();
      return;
    }

    const userId = next?.user.id ?? null;
    // Hydratuj z chmury przy KAŻDYM wykryciu sesji dla nowego użytkownika:
    // `SIGNED_IN` (świeże logowanie) ORAZ `INITIAL_SESSION` (otwarcie z zapisaną
    // sesją — nowa przeglądarka, tryb incognito, powrót z OAuth). supabase-js
    // przetwarza sesję przed podpięciem tego nasłuchiwacza, więc po logowaniu
    // często widzimy `INITIAL_SESSION`, nie `SIGNED_IN` — stąd gating po userId,
    // a nie po nazwie zdarzenia. Pomijamy `TOKEN_REFRESHED` (ten sam userId).
    if (userId && userId !== hydratedUserId) {
      hydratedUserId = userId;
      void syncOnSignIn();
    }
  });
}

/**
 * Dwukierunkowa synchronizacja przy logowaniu: najpierw wciągamy wpisy z chmury
 * do localStorage (`pullAll` → `mergeRemoteEntries`), potem wypychamy stan
 * lokalny z powrotem (`pushAll`), by baza dogoniła ewentualne wpisy offline.
 * Best-effort — błąd sieci nie może wywrócić logowania.
 */
async function syncOnSignIn(): Promise<void> {
  try {
    mergeRemoteEntries(await pullAll());
  } catch {
    // pull/merge to najlepszy wysiłek — w razie błędu zostaje sam push poniżej
  }
  pushAll(getEntries());
}

/**
 * Reaktywna sesja Supabase. Zwraca `null` gdy wylogowany lub brak konfiguracji.
 * Po zalogowaniu (`SIGNED_IN`) jednorazowo synchronizuje dwukierunkowo: wciąga
 * wpisy z chmury do localStorage i wypycha stan lokalny z powrotem (z pominięciem
 * seedów), by oba źródła się zgadzały.
 */
export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(currentSession);

  useEffect(() => {
    initAuth();
    const listener = () => setSession(currentSession);
    sessionListeners.add(listener);
    listener(); // natychmiastowa synchronizacja z bieżącym stanem
    return () => {
      sessionListeners.delete(listener);
    };
  }, []);

  return session;
}

/**
 * Token dostępu aktualnej sesji (JWT) — dosyłany w nagłówku `Authorization` do
 * chronionych endpointów AI (`/api/transcribe`, `/api/therapist`). `null`, gdy
 * wylogowany lub brak konfiguracji.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!isConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Tylko bezpieczne ścieżki wewnętrzne (zaczynają się od jednego `/`), by `next`
 * z URL nie posłużył do open-redirectu na obcą domenę (`//evil.com`).
 */
function safeNext(next: string | undefined, fallback = "/entries"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

/**
 * Rozpoczyna logowanie przez Google. Po powrocie z OAuth ląduje na `next`
 * (domyślnie dziennik `/entries`); ekran ustawień przekazuje `/settings`, by
 * wrócić na swoje miejsce.
 */
export async function signInWithGoogle(next?: string): Promise<void> {
  if (!isConfigured || !supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${safeNext(next)}` },
  });
}

/** Wynik logowania/rejestracji e-mailem — błąd lub potrzeba potwierdzenia maila. */
export interface EmailAuthResult {
  error?: string;
  /** Rejestracja udana, ale konto wymaga potwierdzenia przez link w mailu. */
  needsConfirmation?: boolean;
}

const NOT_CONFIGURED: EmailAuthResult = {
  error: "Logowanie jest niedostępne (brak konfiguracji).",
};

/** Logowanie e-mailem i hasłem. Po sukcesie `useSession` przejmie sesję. */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<EmailAuthResult> {
  if (!isConfigured || !supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

/**
 * Rejestracja e-mailem i hasłem. Gdy w projekcie włączone jest potwierdzanie
 * maila, `signUp` nie zwraca sesji — wtedy sygnalizujemy `needsConfirmation`.
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<EmailAuthResult> {
  if (!isConfigured || !supabase) return NOT_CONFIGURED;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (!data.session) return { needsConfirmation: true };
  return {};
}

/** Wylogowanie. */
export async function signOut(): Promise<void> {
  if (!isConfigured || !supabase) return;
  await supabase.auth.signOut();
}
