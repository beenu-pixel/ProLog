export type Mood = 1 | 2 | 3 | 4 | 5;

/** Pojedynczy wpis dziennika (Etap 1 — przechowywany w localStorage). */
export interface Entry {
  id: string;
  /** Krótki tytuł wpisu. */
  title: string;
  /** Treść z edytora TipTap, zapisywana jako HTML string. */
  content: string;
  /** Nastrój w skali 1–5 (prezentowany jako monochromatyczne kropki). */
  mood: Mood;
  /** Data utworzenia, ISO 8601, ustawiana automatycznie. */
  createdAt: string;
  /** Data ostatniej edycji, ISO 8601 (opcjonalna). */
  updatedAt?: string;
}

/** Dane wejściowe formularza — bez pól nadawanych automatycznie. */
export type EntryInput = Pick<Entry, "title" | "content" | "mood">;
