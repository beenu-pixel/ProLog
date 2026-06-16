import { supabaseAdmin } from "@/lib/supabase-admin";
import { isValidDayKey, todayWarsaw, noonUtcForDay, dayRangeUtc } from "@/lib/api-day";
import { deriveTitle, rowToEntry, type EntryRow } from "@/lib/api-entry";
import { ApiError } from "@/lib/api-error";
import { buildEmbeddingInput, embedText } from "@/lib/services/embeddings";
import type { Entry, MetricKey } from "@/lib/types";

// Serwis wpisów — jedna implementacja używana przez REST (/api/v1/entries)
// i przez narzędzia MCP. Wejście przyjmujemy jako luźny rekord i walidujemy
// tutaj, więc oba wywołujące zachowują się identycznie (te same kody/komunikaty).
// Wymaga skonfigurowanego service-role — wołające najpierw uwierzytelniają,
// więc `supabaseAdmin` jest tu gwarantowanie dostępny.

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
 * Tworzy nowy wpis dla użytkownika. Domyślnie na dziś (Europe/Warsaw); tytuł
 * generowany z treści. Rzuca `ApiError` przy złych danych (400) lub błędzie
 * zapisu (500).
 */
export async function createEntry(
  userId: string,
  input: Record<string, unknown>
): Promise<Entry> {
  const content = input.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new ApiError(400, "Pole `content` jest wymagane (niepusty tekst).");
  }

  // Dzień: domyślnie dziś (PL); walidacja formatu, gdy podany.
  let day = todayWarsaw();
  if (input.date !== undefined) {
    if (!isValidDayKey(input.date)) {
      throw new ApiError(400, "Pole `date` musi mieć format YYYY-MM-DD.");
    }
    day = input.date;
  }

  // Metryki — każda opcjonalna, w skali 1–5.
  const metrics: Partial<Record<MetricKey, number>> = {};
  for (const key of METRIC_KEYS) {
    const parsed = parseScale(input[key]);
    if (parsed === false) {
      throw new ApiError(400, `Pole \`${key}\` musi być liczbą całkowitą 1–5.`);
    }
    if (parsed !== null) metrics[key] = parsed;
  }

  const row = {
    // Tabela `entries` nie ma DEFAULT na `id` (UUID nadaje klient/serwer).
    id: crypto.randomUUID(),
    user_id: userId,
    title: deriveTitle(content),
    content,
    created_at: noonUtcForDay(day),
    ...metrics,
  };

  const { data, error } = await supabaseAdmin!
    .from("entries")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[services/entries] insert failed:", error);
    throw new ApiError(500, "Nie udało się zapisać wpisu.");
  }

  const saved = data as EntryRow;

  // Embedding (best-effort): nowy wpis dostaje wektor od razu. Błąd embeddingu
  // (brak/nieczynny OPENAI_API_KEY itp.) NIE wywraca tworzenia wpisu — backfill
  // dobierze brakujące wektory później.
  try {
    const vector = await embedText(buildEmbeddingInput(saved.title, saved.content));
    const { error: embedError } = await supabaseAdmin!
      .from("entries")
      .update({ embedding: JSON.stringify(vector) })
      .eq("id", saved.id);
    if (embedError) {
      console.error("[services/entries] embedding update failed:", embedError);
    }
  } catch (err) {
    console.error("[services/entries] embedding failed:", err);
  }

  return rowToEntry(saved);
}

/**
 * Zwraca wpis(y) użytkownika z danego dnia (Europe/Warsaw). Rzuca `ApiError`
 * przy złym formacie daty (400) lub błędzie odczytu (500).
 */
export async function getEntriesForDay(
  userId: string,
  date: unknown
): Promise<{ date: string; entries: Entry[] }> {
  if (!isValidDayKey(date)) {
    throw new ApiError(400, "Parametr `date` musi mieć format YYYY-MM-DD.");
  }

  const { startUtc, endUtc } = dayRangeUtc(date);
  const { data, error } = await supabaseAdmin!
    .from("entries")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[services/entries] select failed:", error);
    throw new ApiError(500, "Nie udało się pobrać wpisów.");
  }

  return { date, entries: (data as EntryRow[]).map(rowToEntry) };
}
