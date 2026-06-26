import { isValidDayKey, todayWarsaw, noonUtcForDay, dayRangeUtc } from "@/lib/api-day";
import { deriveTitle } from "@/lib/api-entry";
import { ApiError } from "@/lib/api-error";
import { sanitizeEntryHtml } from "@/lib/sanitize";
import { upsertEntry, getEntriesByDateRange } from "@/lib/services/cms-entries";
import { upsertEntryIndex } from "@/lib/services/entry-index";
import type { Entry, MetricKey, Scale } from "@/lib/types";

// Serwis wpisów — jedna implementacja używana przez REST (/api/v1/entries) i MCP.
// Po migracji ŹRÓDŁEM PRAWDY jest Strapi: zapis idzie do Strapi (upsert po localId),
// a do Supabase trafia tylko indeks wektorowy (embedding + link) — best-effort.

const METRIC_KEYS: MetricKey[] = [
  "sleep",
  "energy",
  "mood",
  "productivity",
  "stress",
];

/** Zwraca liczbę 1–5 albo `null` (brak), albo `false` (błędna wartość). */
function parseScale(value: unknown): number | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (value < 1 || value > 5) return false;
  return value;
}

/**
 * Tworzy nowy wpis dla użytkownika (źródło prawdy = Strapi). Domyślnie na dziś
 * (Europe/Warsaw); tytuł generowany z treści. Rzuca `ApiError` przy złych danych
 * (400) lub błędzie zapisu (502).
 */
export async function createEntry(
  userId: string,
  input: Record<string, unknown>
): Promise<Entry> {
  const rawContent = input.content;
  if (typeof rawContent !== "string" || rawContent.trim() === "") {
    throw new ApiError(400, "Pole `content` jest wymagane (niepusty tekst).");
  }
  // Treść może zawierać HTML (REST/MCP przyjmują dowolny markup) i jest renderowana
  // przez `dangerouslySetInnerHTML` — czyścimy ją tu, na granicy zapisu (defense in depth).
  const content = sanitizeEntryHtml(rawContent);

  // Dzień: domyślnie dziś (PL); walidacja formatu, gdy podany.
  let day = todayWarsaw();
  if (input.date !== undefined) {
    if (!isValidDayKey(input.date)) {
      throw new ApiError(400, "Pole `date` musi mieć format YYYY-MM-DD.");
    }
    day = input.date;
  }

  // Metryki — każda opcjonalna, w skali 1–5.
  const metrics: Partial<Record<MetricKey, Scale>> = {};
  for (const key of METRIC_KEYS) {
    const parsed = parseScale(input[key]);
    if (parsed === false) {
      throw new ApiError(400, `Pole \`${key}\` musi być liczbą całkowitą 1–5.`);
    }
    if (parsed !== null) metrics[key] = parsed as Scale;
  }

  const entry: Entry = {
    id: crypto.randomUUID(),
    title: deriveTitle(content),
    content,
    createdAt: noonUtcForDay(day),
    ...metrics,
  };

  let saved;
  try {
    saved = await upsertEntry(userId, entry);
  } catch (err) {
    console.error("[services/entries] strapi upsert failed:", err);
    throw new ApiError(502, "Nie udało się zapisać wpisu.");
  }

  // Indeks wektorowy (embedding + link) — best-effort, nie wywraca zapisu.
  await upsertEntryIndex({
    localId: saved.id,
    strapiDocId: saved.strapiDocId,
    userId,
    title: saved.title,
    content: saved.content,
    entryDate: saved.createdAt,
  });

  return saved;
}

/**
 * Zwraca wpis(y) użytkownika z danego dnia (Europe/Warsaw) ze Strapi. Rzuca
 * `ApiError` przy złym formacie daty (400) lub błędzie odczytu (502).
 */
export async function getEntriesForDay(
  userId: string,
  date: unknown
): Promise<{ date: string; entries: Entry[] }> {
  if (!isValidDayKey(date)) {
    throw new ApiError(400, "Parametr `date` musi mieć format YYYY-MM-DD.");
  }

  const { startUtc, endUtc } = dayRangeUtc(date);
  try {
    const entries = await getEntriesByDateRange(userId, startUtc, endUtc);
    return { date, entries };
  } catch (err) {
    console.error("[services/entries] strapi read failed:", err);
    throw new ApiError(502, "Nie udało się pobrać wpisów.");
  }
}
