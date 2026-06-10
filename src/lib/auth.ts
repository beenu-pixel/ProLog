"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase, isConfigured } from "@/lib/supabase";
import { getEntries } from "@/lib/storage";
import { pushAll } from "@/lib/sync";

// --- Współdzielony store sesji --------------------------------------------
// Pojedyncza subskrypcja `onAuthStateChange` dla całej aplikacji (useSession
// jest wołane przez wiele komponentów). Dzięki temu mamy jeden nasłuchiwacz i
// dokładnie jeden `pushAll` na zdarzenie logowania, a nie po jednym na komponent.

let currentSession: Session | null = null;
const sessionListeners = new Set<() => void>();
let authInitialized = false;

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
    if (event === "SIGNED_IN") pushAll(getEntries());
  });
}

/**
 * Reaktywna sesja Supabase. Zwraca `null` gdy wylogowany lub brak konfiguracji.
 * Po zalogowaniu (`SIGNED_IN`) jednorazowo wypycha lokalne wpisy do bazy
 * (z pominięciem seedów), by chmura dogoniła stan z localStorage.
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

/** Rozpoczyna logowanie przez Google (redirect z powrotem na /settings). */
export async function signInWithGoogle(): Promise<void> {
  if (!isConfigured || !supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/settings` },
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
