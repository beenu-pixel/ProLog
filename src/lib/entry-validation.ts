import { toExcerpt } from "@/lib/format";
import { deriveTitle } from "@/lib/api-entry";

/**
 * Reguły zapisu wpisu. AI i wyszukiwanie hybrydowe opierają się na TEKŚCIE,
 * więc każdy wpis powinien nieść tekst (tytuł lub treść). Wyjątek: wpis bez
 * tekstu jest dozwolony, jeśli ma zdjęcie ORAZ określony nastrój (≥1 metryka).
 * „Samo zdjęcie bez niczego" ani całkiem pusty wpis nie przechodzi.
 */

/** Czy treść (HTML z TipTap) zawiera realny tekst (po odcięciu tagów/whitespace). */
export function htmlHasText(content: string | undefined | null): boolean {
  if (!content) return false;
  return toExcerpt(content).length > 0;
}

export interface EntryDraftShape {
  title: string;
  content: string;
  /** Liczba dołączonych zdjęć. */
  photoCount: number;
  /** Liczba ustawionych metryk (nastrojów) 1–5. */
  metricCount: number;
}

export type SaveBlockReason = "empty" | "photos-need-mood";

export interface SaveCheck {
  ok: boolean;
  reason?: SaveBlockReason;
}

/** Komunikaty błędu dla powodów blokady zapisu. */
export const SAVE_BLOCK_MESSAGE: Record<SaveBlockReason, string> = {
  empty: "Dodaj treść lub tytuł (albo zdjęcie z nastrojem).",
  "photos-need-mood":
    "Do wpisu bez tekstu wybierz nastrój (przynajmniej jeden) lub dopisz tytuł.",
};

/**
 * Czy wpis można zapisać. Dozwolone, gdy jest tekst (tytuł lub treść), albo
 * gdy jest zdjęcie i przynajmniej jedna metryka nastroju.
 */
export function canSaveEntry({
  title,
  content,
  photoCount,
  metricCount,
}: EntryDraftShape): SaveCheck {
  const hasText = title.trim() !== "" || htmlHasText(content);
  if (hasText) return { ok: true };
  if (photoCount > 0 && metricCount > 0) return { ok: true };
  return { ok: false, reason: photoCount > 0 ? "photos-need-mood" : "empty" };
}

/**
 * Tytuł do zapisu: użyj wpisanego, a gdy pusty — wywnioskuj z treści; przy
 * braku treści, a obecnych zdjęciach, użyj czytelnego zastępnika.
 */
export function resolveTitle({
  title,
  content,
  photoCount,
}: {
  title: string;
  content: string;
  photoCount: number;
}): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  if (htmlHasText(content)) return deriveTitle(content);
  if (photoCount > 0) return "Wpis ze zdjęciami";
  return deriveTitle(content);
}
