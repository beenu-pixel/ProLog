// Dane prezentacyjne planów (nazwa, cena, opis, lista funkcji) — JEDNO źródło dla
// strony /pricing oraz sekcji cen na landingu. Client-safe (bez importów serwerowych).
// Progi/ceny to placeholdery spójne z PLAN_LIMITS w plans.ts (kalibracja osobno).

export interface PlanCard {
  id: "free" | "pro" | "max";
  name: string;
  price: string;
  tagline: string;
  features: string[];
  /** Wyróżniony plan (ramka/akcent). */
  featured?: boolean;
}

export const PLAN_CARDS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    price: "0 zł",
    tagline: "Dziennik bez ograniczeń + przedsmak AI.",
    features: [
      "Cały dziennik: wpisy, zdjęcia, motyw, zwykłe wyszukiwanie",
      "Rozmowy z Freudem — 5 dziennie",
      "Dostęp do własnych danych przez API/MCP (eksport)",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "~39 zł / mies.",
    tagline: "Pełne AI: wszystkie persony, pamięć, raporty.",
    featured: true,
    features: [
      "Wszystkie 5 person terapeuty",
      "Znacznie wyższe limity rozmów AI",
      "Pełna pamięć i głębia kontekstu (RAG)",
      "Tygodniowe raporty nastroju i wątków",
      "Hojne limity transkrypcji i inteligentnego wyszukiwania",
    ],
  },
  {
    id: "max",
    name: "Max",
    price: "~79 zł / mies.",
    tagline: "Dla najbardziej zaangażowanych.",
    features: [
      "Wszystko z Pro",
      "Najwyższe limity (praktycznie bez ograniczeń)",
      "Raporty tygodniowe i miesięczne",
    ],
  },
];
