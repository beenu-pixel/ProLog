import type { Entry, EntryInput } from "@/lib/types";
import { buildSeedEntries } from "@/lib/seed";

const STORAGE_KEY = "prolog.entries";
// Flaga „już zasiano" — żeby nie odtwarzać przykładowych wpisów po tym, jak
// użytkownik świadomie usunie wszystkie wpisy. Sufiks wersji: po zmianie zestawu
// seeda podbijamy go, by zasiać od nowa u osób, które mają pusty dziennik.
const SEED_FLAG_KEY = "prolog.seeded.v2";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readRaw(): Entry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Entry[]) : [];
  } catch {
    return [];
  }
}

function sortByNewest(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// --- Zewnętrzny store dla useSyncExternalStore ---------------------------
// Trzymamy zbuforowany snapshot o stabilnej referencji; nowa referencja
// powstaje wyłącznie po realnej zmianie danych. Dzięki temu hooki nie wpadają
// w pętlę re-renderów.

const EMPTY: Entry[] = [];
let cache: Entry[] | null = null;
const listeners = new Set<() => void>();
let storageBound = false;

function recompute(): void {
  cache = sortByNewest(readRaw());
}

function notify(): void {
  recompute();
  listeners.forEach((listener) => listener());
}

function onStorageEvent(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) notify();
}

/** Subskrypcja zmian wpisów (dla useSyncExternalStore). */
export function subscribeEntries(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageBound && isBrowser()) {
    window.addEventListener("storage", onStorageEvent);
    storageBound = true;
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot po stronie klienta (stabilna referencja między wywołaniami). */
export function getEntriesSnapshot(): Entry[] {
  if (cache === null) recompute();
  return cache ?? EMPTY;
}

/** Snapshot po stronie serwera — zawsze pusty, stała referencja. */
export function getServerEntriesSnapshot(): Entry[] {
  return EMPTY;
}

function writeRaw(entries: Entry[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  notify();
}

/**
 * Jednorazowo zasiewa przykładowe wpisy, gdy dziennik jest pusty. Wywoływane
 * po stronie klienta (np. z layoutu). Bezpieczne do wielokrotnego wywołania —
 * po pierwszym razie ustawia flagę i nic więcej nie robi.
 */
export function seedIfEmpty(): void {
  if (!isBrowser()) return;
  try {
    if (window.localStorage.getItem(SEED_FLAG_KEY)) return;
    if (readRaw().length === 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSeedEntries()));
    }
    window.localStorage.setItem(SEED_FLAG_KEY, "1");
    notify();
  } catch {
    // Brak dostępu do localStorage — pomijamy zasianie.
  }
}

// --- CRUD ----------------------------------------------------------------

/** Wszystkie wpisy, najnowsze na górze (odczyt imperatywny). */
export function getEntries(): Entry[] {
  return sortByNewest(readRaw());
}

export function getEntry(id: string): Entry | undefined {
  return readRaw().find((entry) => entry.id === id);
}

export function addEntry(input: EntryInput): Entry {
  const entry: Entry = {
    id:
      isBrowser() && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: input.title,
    content: input.content,
    mood: input.mood,
    createdAt: new Date().toISOString(),
  };
  writeRaw([entry, ...readRaw()]);
  return entry;
}

export function updateEntry(id: string, input: EntryInput): Entry | undefined {
  const entries = readRaw();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) return undefined;

  const updated: Entry = {
    ...entries[index],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  entries[index] = updated;
  writeRaw(entries);
  return updated;
}

export function deleteEntry(id: string): void {
  writeRaw(readRaw().filter((entry) => entry.id !== id));
}

export { STORAGE_KEY };
