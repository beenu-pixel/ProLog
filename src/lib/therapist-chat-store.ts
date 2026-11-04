"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_THERAPIST } from "@/lib/therapists";
import {
  getActiveTherapistId,
  setActiveTherapistId,
} from "@/lib/active-therapist";
import { getAccessToken } from "@/lib/auth";
import { noteFromHeaders } from "@/hooks/use-ai-limits";
import {
  type ChatMessage,
  loadHistory,
  persistMessage,
  clearHistory as clearStored,
} from "@/lib/therapist-store";

// Reaktywny store stanu rozmowy z terapeutą (wzorzec useSyncExternalStore, jak
// `storage.ts`). Współdzielony przez pole pisania (wysyłka) i ekran `/chat`
// (lista wiadomości).

type Status = "idle" | "streaming";

interface ChatState {
  messages: ChatMessage[];
  status: Status;
  historyLoading: boolean;
}

let messages: ChatMessage[] = [];
let status: Status = "idle";
let historyLoading = false;
let loaded = false;
// Aktywna persona dla TEJ rozmowy. Inicjalizowana domyślną; przy pierwszym
// wczytaniu i przy `selectTherapist` synchronizowana z `active-therapist`
// (localStorage). Historia jest osobna per `therapistId`.
let therapistId = DEFAULT_THERAPIST.id;

const listeners = new Set<() => void>();

// Snapshot o stabilnej referencji — nowa powstaje tylko po realnej zmianie.
let snapshot: ChatState = { messages, status, historyLoading };
const SERVER_SNAPSHOT: ChatState = {
  messages: [],
  status: "idle",
  historyLoading: false,
};

function emit(): void {
  snapshot = { messages, status, historyLoading };
  listeners.forEach((listener) => listener());
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function updateAssistant(id: string, content: string): void {
  messages = messages.map((m) => (m.id === id ? { ...m, content } : m));
}

/** Leniwe wczytanie historii (przy pierwszym wejściu w rozmowę). */
async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  // Zsynchronizuj wybraną personę z localStorage przy pierwszym wczytaniu.
  const persisted = getActiveTherapistId();
  if (persisted !== therapistId) therapistId = persisted;
  historyLoading = true;
  emit();
  const requested = therapistId;
  const stored = await loadHistory(requested);
  // Persona zmieniona w trakcie: wynik dotyczy innego wątku, a stan ładowania
  // należy już do nowego wywołania.
  if (requested !== therapistId) return;
  // Tylko gdy nic nie dopisano w międzyczasie (np. szybka pierwsza wiadomość).
  if (messages.length === 0 && stored.length > 0) messages = stored;
  historyLoading = false;
  emit();
}

/** Wczytuje historię rozmowy (ekran `/chat`). */
export async function loadChat(): Promise<void> {
  await ensureLoaded();
}

/**
 * Przełącza aktywną personę: zapisuje wybór (localStorage), czyści bieżącą
 * rozmowę z pamięci i wczytuje historię nowej persony. Wołane z przełącznika w
 * nagłówku czatu oraz z Ustawień.
 */
export async function selectTherapist(id: string): Promise<void> {
  if (id === therapistId) return;
  therapistId = id;
  setActiveTherapistId(id); // utrwala wybór i odświeża nazwę w UI
  messages = [];
  status = "idle";
  loaded = false;
  emit();
  await ensureLoaded();
}

/** Id aktywnej persony tej rozmowy (poza Reactem). */
export function activeTherapistId(): string {
  return therapistId;
}

/**
 * Wysyła wiadomość użytkownika i strumieniuje odpowiedź terapeuty. `journalContext`
 * (wpisy) i `uiContext` (otwarty dzień + data) buduje wołający z aktualnego stanu.
 */
export async function sendMessage(
  text: string,
  journalContext: string,
  uiContext: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || status === "streaming") return;

  const userMessage: ChatMessage = {
    id: uid(),
    role: "user",
    content: trimmed,
    createdAt: new Date().toISOString(),
  };
  messages = [...messages, userMessage];
  status = "streaming";
  emit();
  persistMessage(therapistId, userMessage);

  // Historia do wysłania — przed dodaniem pustego dymka asystenta.
  const history = messages.map(({ role, content }) => ({ role, content }));

  const assistant: ChatMessage = {
    id: uid(),
    role: "assistant",
    content: "",
    createdAt: new Date().toISOString(),
  };
  messages = [...messages, assistant];
  emit();

  try {
    const token = await getAccessToken();
    if (!token) throw new Error("not authenticated"); // czat tylko dla zalogowanych
    const res = await fetch("/api/therapist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        therapistId,
        messages: history,
        journalContext,
        uiContext,
      }),
    });
    noteFromHeaders("therapist", res); // odśwież stan limitu (też przy 429)
    if (res.status === 429) {
      updateAssistant(
        assistant.id,
        "Wykorzystałeś dzienny limit pytań do terapeuty. Odnowi się o północy."
      );
      return;
    }
    if (!res.ok || !res.body) throw new Error("bad response");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      updateAssistant(assistant.id, acc);
      emit();
    }

    const finalText = acc.trim();
    if (finalText) {
      persistMessage(therapistId, {
        ...assistant,
        content: finalText,
      });
    } else {
      // Pusta odpowiedź — usuwamy placeholder, by nie wisiał pusty dymek.
      messages = messages.filter((m) => m.id !== assistant.id);
    }
  } catch {
    updateAssistant(
      assistant.id,
      "Przepraszam, nie udało mi się teraz odpowiedzieć. Spróbuj ponownie za chwilę."
    );
  } finally {
    status = "idle";
    emit();
  }
}

/** Czyści całą rozmowę (stan + localStorage + Supabase). */
export function clearHistory(): void {
  messages = [];
  status = "idle";
  emit();
  clearStored(therapistId);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ChatState {
  return snapshot;
}

/** Reaktywny dostęp do stanu rozmowy. */
export function useTherapistChat(): ChatState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}
