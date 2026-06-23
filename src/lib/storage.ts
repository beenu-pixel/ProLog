import type { Entry, EntryInput } from "@/lib/types";
import { buildSeedEntries } from "@/lib/seed";
import { pushEntry, deleteRemote } from "@/lib/sync";
import { deletePhotos } from "@/lib/photos";

const STORAGE_KEY = "prolog.entries";
// „Nagrobki" — id wpisów usuniętych lokalnie, których kasowania w chmurze jeszcze
// nie potwierdzono (brak sesji / błąd sieci). Dopóki id tu jest, `mergeRemoteEntries`
// go nie wskrzesi, a przy logowaniu domykamy usunięcie (`flushPendingDeletes`).
const TOMBSTONES_KEY = "prolog.pending_deletes";
// Flaga „już zasiano" — żeby nie odtwarzać przykładowych wpisów po tym, jak
// użytkownik świadomie usunie wszystkie wpisy. Sufiks wersji: po zmianie zestawu
// seeda podbijamy go, by zasiać od nowa u osób, które mają pusty dziennik.
const SEED_FLAG_KEY = "prolog.seeded.v3";

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

// --- Nagrobki (pending deletes) ------------------------------------------

function readTombstones(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(TOMBSTONES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeTombstones(ids: string[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOMBSTONES_KEY, JSON.stringify([...new Set(ids)]));
}

function addTombstone(id: string): void {
  writeTombstones([...readTombstones(), id]);
}

function removeTombstone(id: string): void {
  writeTombstones(readTombstones().filter((t) => t !== id));
}

// --- Zdjęcia współdzielone ------------------------------------------------

/**
 * Z podanych ścieżek zwraca te, których NIE używa już żaden wpis w localStorage.
 * Dzięki temu kasujemy z bucketa tylko realnie osierocone pliki i nie usuniemy
 * zdjęcia współdzielonego przez inny wpis (np. album i pojedyncze miasto wskazują
 * ten sam plik). Uwaga: sprawdza tylko stan lokalny — plik używany wyłącznie
 * przez wpis obecny tylko w chmurze (przed `pullAll`) nie zostanie wykryty.
 */
export function unreferencedPhotoPaths(candidatePaths: string[]): string[] {
  const referenced = new Set<string>();
  for (const entry of readRaw()) {
    for (const photo of entry.photos ?? []) referenced.add(photo.path);
  }
  return candidatePaths.filter((path) => !referenced.has(path));
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

/**
 * Wciąga wpisy z chmury do localStorage (po zalogowaniu). Łączy po `id`:
 * gdy wpis istnieje lokalnie, wygrywa nowsza wersja (po `updatedAt`/`createdAt`),
 * w razie remisu — wersja z bazy. Wpisy lokalne nieobecne w chmurze zostają
 * nietknięte. Powiadamia subskrybentów tylko, gdy faktycznie coś się zmieniło.
 */
export function mergeRemoteEntries(remote: Entry[]): void {
  if (!isBrowser() || remote.length === 0) return;
  const local = readRaw();
  const byId = new Map(local.map((entry) => [entry.id, entry]));
  // Nie wskrzeszaj wpisów usuniętych lokalnie, których kasowania w chmurze
  // jeszcze nie potwierdzono — inaczej „znikają i wracają" po zalogowaniu.
  const tombstones = new Set(readTombstones());

  const stamp = (entry: Entry): number =>
    new Date(entry.updatedAt ?? entry.createdAt).getTime();

  let changed = false;
  for (const incoming of remote) {
    if (tombstones.has(incoming.id)) continue;
    const existing = byId.get(incoming.id);
    if (!existing) {
      byId.set(incoming.id, incoming);
      changed = true;
    } else if (stamp(incoming) >= stamp(existing)) {
      byId.set(incoming.id, incoming);
      changed = true;
    }
  }

  if (changed) writeRaw([...byId.values()]);
}

/**
 * Czyści lokalny widok wpisów (localStorage). Wołane po wylogowaniu, by na
 * współdzielonym urządzeniu nie zostawały cudze/poprzednie wpisy — w chmurze
 * pozostają nietknięte i wrócą po ponownym zalogowaniu (`mergeRemoteEntries`).
 * Zdejmuje też flagę seeda, aby świeży, niezalogowany stan mógł zasiać demo.
 */
export function clearEntries(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(SEED_FLAG_KEY);
  notify();
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
    ...input,
    createdAt: new Date().toISOString(),
  };
  writeRaw([entry, ...readRaw()]);
  pushEntry(entry);
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
  pushEntry(updated);
  return updated;
}

export function deleteEntry(id: string): void {
  const entry = readRaw().find((e) => e.id === id);
  writeRaw(readRaw().filter((entry) => entry.id !== id));

  // Nagrobek: chroni przed wskrzeszeniem, dopóki chmura nie potwierdzi usunięcia.
  addTombstone(id);
  void deleteRemote(id).then((ok) => {
    if (ok) removeTombstone(id);
  });

  // Best-effort sprzątanie zdjęć — tylko pliki nieużywane przez inne wpisy
  // (wpis jest już usunięty z localStorage, więc `unreferencedPhotoPaths`
  // sprawdza pozostałe). No-op bez sesji.
  if (entry?.photos?.length) {
    const orphaned = unreferencedPhotoPaths(entry.photos.map((p) => p.path));
    if (orphaned.length > 0) void deletePhotos(orphaned);
  }
}

/**
 * Domyka w chmurze usunięcia wykonane offline/bez sesji (po każdym z nich został
 * „nagrobek"). Wołane przy logowaniu PRZED `pullAll`/`mergeRemoteEntries`, by
 * baza nie odesłała z powrotem wpisów, które użytkownik już skasował. Każdy
 * potwierdzony rekord zdejmuje swój nagrobek; nieudane zostają na kolejną próbę.
 */
export async function flushPendingDeletes(): Promise<void> {
  const pending = readTombstones();
  if (pending.length === 0) return;
  for (const id of pending) {
    const ok = await deleteRemote(id);
    if (ok) removeTombstone(id);
  }
}

export { STORAGE_KEY };
