import type { Entry, Scale } from "@/lib/types";

interface SeedSpec {
  /** Ile dni wstecz względem dziś. */
  daysAgo: number;
  title: string;
  /** Akapity treści (zostaną złożone w HTML, tak jak zapisuje TipTap). */
  paragraphs: string[];
  mood: Scale;
  sleep: Scale;
  energy: Scale;
  productivity: Scale;
  /** Poziom stresu (5 = najsilniejszy). */
  stress: Scale;
}

// Przykładowe wpisy wypełniające ostatnie dwa tygodnie (po jednym na każdy z 14
// dni wstecz), gdy dziennik jest pusty. „Dziś" (daysAgo 0) zostaje bez wpisu —
// żeby użytkownik mógł dodać własny na dzisiaj. Wartości metryk są skorelowane
// (lepszy sen/energia → lepsze samopoczucie, niższy stres), żeby statystyki
// wyglądały naturalnie.
const SEED: SeedSpec[] = [
  {
    daysAgo: 1,
    title: "Domknięte zaległości",
    paragraphs: [
      "Przeterminowana praca, ale zrobiłem co mogłem. Jutro będzie spokojniej.",
      "Wieczorem trochę czytania i wcześniejsze pójście spać.",
    ],
    mood: 3,
    sleep: 3,
    energy: 3,
    productivity: 4,
    stress: 3,
  },
  {
    daysAgo: 2,
    title: "Spokojny wieczór",
    paragraphs: [
      "Cichy dzień bez niespodzianek. W końcu nadrobiłem zaległe maile.",
    ],
    mood: 4,
    sleep: 4,
    energy: 4,
    productivity: 3,
    stress: 2,
  },
  {
    daysAgo: 3,
    title: "Spacer rozjaśnił głowę",
    paragraphs: [
      "Długi spacer po pracy zrobił swoje. Najlepsze decyzje przychodzą w ruchu.",
    ],
    mood: 4,
    sleep: 4,
    energy: 4,
    productivity: 3,
    stress: 2,
  },
  {
    daysAgo: 4,
    title: "Emocjonalna sinusoida",
    paragraphs: [
      "Dzień z emocjonalnymi wzlotami i upadkami. Ale ogólnie w porządku.",
      "Pomogła krótka rozmowa z bliską osobą — warto prosić o wsparcie.",
    ],
    mood: 3,
    sleep: 3,
    energy: 3,
    productivity: 3,
    stress: 3,
  },
  {
    daysAgo: 5,
    title: "Dużo stresu w pracy",
    paragraphs: [
      "Trudny dzień w pracy, dużo stresu. Wieczorem odpoczywałem czytając książkę.",
      "Zapisuję sobie, że napięcie najbardziej rosło przy nieplanowanych spotkaniach.",
    ],
    mood: 2,
    sleep: 2,
    energy: 2,
    productivity: 2,
    stress: 4,
  },
  {
    daysAgo: 6,
    title: "Mały sukces",
    paragraphs: [
      "Skończyłem zadanie, które odkładałem od tygodni. Ulga i trochę dumy.",
    ],
    mood: 5,
    sleep: 4,
    energy: 5,
    productivity: 5,
    stress: 1,
  },
  {
    daysAgo: 7,
    title: "Energia i motywacja",
    paragraphs: [
      "Miły dzień, dużo energii i motywacji do pracy. Spotkałem się ze znajomymi.",
      "Wieczorny spacer dodał świeżości — chcę to powtarzać częściej.",
    ],
    mood: 5,
    sleep: 5,
    energy: 5,
    productivity: 4,
    stress: 1,
  },
  {
    daysAgo: 8,
    title: "Powrót do rutyny",
    paragraphs: [
      "Wracam do codziennych nawyków po kilku luźniejszych dniach.",
      "Poranna kawa, lista zadań, jedna rzecz naraz — działa najlepiej.",
    ],
    mood: 4,
    sleep: 4,
    energy: 4,
    productivity: 4,
    stress: 2,
  },
  {
    daysAgo: 9,
    title: "Zmęczenie, ale satysfakcja",
    paragraphs: [
      "Długi dzień, sporo zrobione. Zmęczenie, ale i satysfakcja z postępu.",
    ],
    mood: 3,
    sleep: 2,
    energy: 3,
    productivity: 4,
    stress: 3,
  },
  {
    daysAgo: 10,
    title: "Przerwa od ekranów",
    paragraphs: [
      "Odłożyłem telefon na kilka godzin i od razu spokojniejsza głowa.",
      "Notuję to jako mały eksperyment, który chcę powtórzyć.",
    ],
    mood: 4,
    sleep: 4,
    energy: 4,
    productivity: 3,
    stress: 2,
  },
  {
    daysAgo: 11,
    title: "Trudna rozmowa",
    paragraphs: [
      "Niełatwa rozmowa, ale potrzebna. Czuję ulgę, że temat został wyjaśniony.",
    ],
    mood: 2,
    sleep: 3,
    energy: 2,
    productivity: 2,
    stress: 4,
  },
  {
    daysAgo: 12,
    title: "Pierwszy bieg od dawna",
    paragraphs: [
      "Wróciłem do biegania. Ciężko, ale po wszystkim mnóstwo dobrej energii.",
    ],
    mood: 5,
    sleep: 4,
    energy: 5,
    productivity: 4,
    stress: 1,
  },
  {
    daysAgo: 13,
    title: "Porządki i planowanie",
    paragraphs: [
      "Uporządkowałem zaległe sprawy i rozpisałem plan na najbliższy tydzień.",
      "Czyste biurko, czysta głowa.",
    ],
    mood: 4,
    sleep: 4,
    energy: 3,
    productivity: 5,
    stress: 2,
  },
  {
    daysAgo: 14,
    title: "Wieczór z książką",
    paragraphs: [
      "Spokojny wieczór: rozdział dobrej książki i wcześniejszy sen.",
    ],
    mood: 4,
    sleep: 5,
    energy: 4,
    productivity: 3,
    stress: 2,
  },
];

/** Prefiks id wpisów-seedów (wypełniacz demonstracyjny UI). */
export const SEED_ID_PREFIX = "seed-";

/**
 * Czy wpis to seed (przykładowy wypełniacz). Seedy mają id `seed-NN`. Używane,
 * by ukryć je przed zalogowanym użytkownikiem i nie wysyłać ich do bazy.
 */
export function isSeedEntry(entry: Pick<Entry, "id">): boolean {
  return entry.id.startsWith(SEED_ID_PREFIX);
}

/** Składa akapity w HTML zgodny z formatem treści edytora. */
function toHtml(paragraphs: string[]): string {
  return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

/** Data wpisu: `n` dni wstecz, ustawiona na wieczór dla naturalnej kolejności. */
function daysAgoIso(n: number): string {
  const date = new Date();
  date.setHours(20, 0, 0, 0);
  date.setDate(date.getDate() - n);
  return date.toISOString();
}

/** Buduje pełną listę przykładowych wpisów (do zasiania pustego dziennika). */
export function buildSeedEntries(): Entry[] {
  return SEED.map((spec, index) => ({
    id: `seed-${String(index + 1).padStart(2, "0")}`,
    title: spec.title,
    content: toHtml(spec.paragraphs),
    mood: spec.mood,
    sleep: spec.sleep,
    energy: spec.energy,
    productivity: spec.productivity,
    stress: spec.stress,
    createdAt: daysAgoIso(spec.daysAgo),
  }));
}
