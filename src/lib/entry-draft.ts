/**
 * Minimalny magazyn „wersji roboczej" notatki przekazywanej z dolnego paska
 * (pole kompozytora) do kreatora wpisu `/new`. Trzymamy treść w `sessionStorage`,
 * żeby przetrwała nawigację (i ewentualne odświeżenie), a kreator zabiera ją raz
 * przy starcie (`takeDraft` czyta i czyści).
 */
const DRAFT_KEY = "prolog:entry-draft";

/** Zapisuje treść notatki jako wersję roboczą dla kreatora `/new`. */
export function setDraft(content: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, content);
  } catch {
    // brak dostępu do sessionStorage (tryb prywatny itp.) — ignorujemy
  }
}

/** Odczytuje i CZYŚCI wersję roboczą. Zwraca `null`, gdy jej nie ma. */
export function takeDraft(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(DRAFT_KEY);
    if (value !== null) window.sessionStorage.removeItem(DRAFT_KEY);
    return value;
  } catch {
    return null;
  }
}
