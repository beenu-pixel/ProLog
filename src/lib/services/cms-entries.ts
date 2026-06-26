import "server-only";

import type { Entry, EntryPhoto } from "@/lib/types";

// Serwis wpisów w Strapi (źródło prawdy). Wołany WYŁĄCZNIE po stronie serwera —
// używa pełnoprawnego tokena (zapis), który nigdy nie trafia do przeglądarki.
// Klient rozmawia z tym serwisem przez route'y /api/cms/entries (auth sesją).
//
// Strapi v5: pola zwracane „płasko" (bez `attributes`); zapis w body `{ data: {...} }`.
// Mapowanie: `Entry.id` ↔ Strapi `localId` (UUID z localStorage), `Entry.createdAt` ↔ `entryDate`.

const STRAPI_URL = process.env.STRAPI_API_URL?.replace(/\/$/, "");
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

type StrapiEntry = {
  id: number;
  documentId: string;
  title: string;
  content: string | null;
  mood: number | null;
  sleep: number | null;
  energy: number | null;
  productivity: number | null;
  stress: number | null;
  entryDate: string | null;
  userId: string;
  localId: string;
  photos: EntryPhoto[] | null;
  createdAt: string;
  updatedAt: string;
};

/** Wpis z dołączonym `documentId` Strapi (potrzebny do aktualizacji indeksu). */
export type CmsEntry = Entry & { strapiDocId: string };

function assertConfig() {
  if (!STRAPI_URL || !STRAPI_TOKEN) {
    throw new Error("Brak konfiguracji STRAPI_API_URL / STRAPI_API_TOKEN.");
  }
}

async function strapi<T>(path: string, init?: RequestInit): Promise<T> {
  assertConfig();
  const res = await fetch(`${STRAPI_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${STRAPI_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strapi ${path} → HTTP ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

function toEntry(s: StrapiEntry): CmsEntry {
  return {
    id: s.localId,
    title: s.title,
    content: s.content ?? "",
    mood: (s.mood ?? undefined) as Entry["mood"],
    sleep: (s.sleep ?? undefined) as Entry["sleep"],
    energy: (s.energy ?? undefined) as Entry["energy"],
    productivity: (s.productivity ?? undefined) as Entry["productivity"],
    stress: (s.stress ?? undefined) as Entry["stress"],
    photos: s.photos ?? [],
    createdAt: s.entryDate ?? s.createdAt,
    updatedAt: s.updatedAt ?? undefined,
    strapiDocId: s.documentId,
  };
}

function toData(entry: Entry, userId: string) {
  return {
    title: entry.title,
    content: entry.content,
    mood: entry.mood ?? null,
    sleep: entry.sleep ?? null,
    energy: entry.energy ?? null,
    productivity: entry.productivity ?? null,
    stress: entry.stress ?? null,
    entryDate: entry.createdAt,
    userId,
    localId: entry.id,
    photos: entry.photos ?? [],
  };
}

const enc = (s: string) => encodeURIComponent(s);

/** Wszystkie wpisy użytkownika (stronicowanie po 100), od najnowszych. */
export async function listEntriesByUser(userId: string): Promise<CmsEntry[]> {
  const out: CmsEntry[] = [];
  let page = 1;
  for (;;) {
    const json = await strapi<{
      data: StrapiEntry[];
      meta: { pagination: { pageCount: number } };
    }>(
      `/api/entries?filters[userId][$eq]=${enc(userId)}&sort=entryDate:desc&pagination[page]=${page}&pagination[pageSize]=100`
    );
    out.push(...json.data.map(toEntry));
    if (page >= (json.meta?.pagination?.pageCount ?? 1)) break;
    page += 1;
  }
  return out;
}

async function findByLocalId(userId: string, localId: string): Promise<StrapiEntry | null> {
  const json = await strapi<{ data: StrapiEntry[] }>(
    `/api/entries?filters[userId][$eq]=${enc(userId)}&filters[localId][$eq]=${enc(localId)}&pagination[pageSize]=1`
  );
  return json.data[0] ?? null;
}

/** Upsert wpisu po `localId` (create albo update). */
export async function upsertEntry(userId: string, entry: Entry): Promise<CmsEntry> {
  const existing = await findByLocalId(userId, entry.id);
  const body = JSON.stringify({ data: toData(entry, userId) });
  if (existing) {
    const json = await strapi<{ data: StrapiEntry }>(`/api/entries/${existing.documentId}`, {
      method: "PUT",
      body,
    });
    return toEntry(json.data);
  }
  const json = await strapi<{ data: StrapiEntry }>(`/api/entries`, { method: "POST", body });
  return toEntry(json.data);
}

/** Usuwa wpis po `localId`. Zwraca `false`, gdy wpis nie istniał. */
export async function deleteEntryByLocalId(userId: string, localId: string): Promise<boolean> {
  const existing = await findByLocalId(userId, localId);
  if (!existing) return false;
  await strapi(`/api/entries/${existing.documentId}`, { method: "DELETE" });
  return true;
}

/** Wpisy z danego zakresu dat (po `entryDate`) — dla REST `/api/v1/entries/[date]`. */
export async function getEntriesByDateRange(
  userId: string,
  startIso: string,
  endIso: string
): Promise<CmsEntry[]> {
  const json = await strapi<{ data: StrapiEntry[] }>(
    `/api/entries?filters[userId][$eq]=${enc(userId)}` +
      `&filters[entryDate][$gte]=${enc(startIso)}&filters[entryDate][$lt]=${enc(endIso)}` +
      `&sort=entryDate:asc&pagination[pageSize]=100`
  );
  return json.data.map(toEntry);
}

/** Pobiera wpisy po zbiorze `localId` (dla RAG — treść do kontekstu). */
export async function getEntriesByLocalIds(userId: string, localIds: string[]): Promise<CmsEntry[]> {
  if (localIds.length === 0) return [];
  const filters = localIds
    .map((id, i) => `filters[localId][$in][${i}]=${enc(id)}`)
    .join("&");
  const json = await strapi<{ data: StrapiEntry[] }>(
    `/api/entries?filters[userId][$eq]=${enc(userId)}&${filters}&pagination[pageSize]=100`
  );
  return json.data.map(toEntry);
}
