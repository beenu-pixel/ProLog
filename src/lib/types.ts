/** Skala 1–5 używana przez wszystkie metryki dnia. */
export type Scale = 1 | 2 | 3 | 4 | 5;

/** Alias zachowany dla istniejących importów (samopoczucie/nastrój). */
export type Mood = Scale;

/** Klucze metryk zapisywanych z wpisem (kolejność = kolejność kroków kreatora). */
export type MetricKey = "sleep" | "energy" | "mood" | "productivity" | "stress";

/** Pojedyncze zdjęcie wpisu — referencja do obiektu w prywatnym buckecie Storage. */
export interface EntryPhoto {
  /** Stabilny identyfikator (klucz Reacta, część nazwy pliku). */
  id: string;
  /** Ścieżka obiektu w buckecie `entry-photos`: `${userId}/${id}.${ext}`. */
  path: string;
}

/** Pojedynczy wpis dziennika (Etap 1 — przechowywany w localStorage). */
export interface Entry {
  id: string;
  /** Krótki tytuł wpisu. */
  title: string;
  /** Treść z edytora TipTap, zapisywana jako HTML string. */
  content: string;
  /** Samopoczucie/nastrój (1–5). Opcjonalne — starsze wpisy mogą go nie mieć. */
  mood?: Scale;
  /** Jakość snu (1–5). */
  sleep?: Scale;
  /** Energia (1–5). */
  energy?: Scale;
  /** Produktywność (1–5). */
  productivity?: Scale;
  /** Poziom stresu (1–5, gdzie 5 = najsilniejszy stres). */
  stress?: Scale;
  /** Data utworzenia, ISO 8601, ustawiana automatycznie. */
  createdAt: string;
  /** Data ostatniej edycji, ISO 8601 (opcjonalna). */
  updatedAt?: string;
  /** Zdjęcia dołączone do wpisu (opcjonalne — wpis może mieć sam tekst). */
  photos?: EntryPhoto[];
}

/** Dane wejściowe formularza/kreatora — bez pól nadawanych automatycznie. */
export type EntryInput = Pick<Entry, "title" | "content" | MetricKey> & {
  photos?: EntryPhoto[];
};
