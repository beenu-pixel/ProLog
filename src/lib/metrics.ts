import type { Entry, MetricKey, Scale } from "@/lib/types";

/** Etykiety poziomów samopoczucia 1–5 (kanoniczne źródło, reużywane w UI). */
export const MOOD_LABELS: Record<Scale, string> = {
  1: "Bardzo źle",
  2: "Słabo",
  3: "Neutralnie",
  4: "Dobrze",
  5: "Bardzo dobrze",
};

export interface MetricDef {
  key: MetricKey;
  /** Nazwa metryki (np. na liście metryk w szczególe). */
  label: string;
  /** Najkrótsza nazwa — do zwartego „pulsu dnia” w pięciu kolumnach. */
  short: string;
  /** Pytanie-nagłówek na ekranie kreatora. */
  prompt: string;
  /** Etykiety słowne poziomów 1..5. */
  levels: [string, string, string, string, string];
  /** true dla metryk, gdzie wyższa wartość = gorzej (np. stres). */
  inverted?: boolean;
}

/**
 * Rejestr metryk dnia — jedno źródło prawdy. Kolejność elementów wyznacza
 * kolejność kroków w kreatorze nowego wpisu.
 */
export const METRICS: MetricDef[] = [
  {
    key: "sleep",
    label: "Jakość snu",
    short: "Sen",
    prompt: "Jak Ci się spało?",
    levels: ["Bardzo źle", "Słabo", "Średnio", "Dobrze", "Świetnie"],
  },
  {
    key: "energy",
    label: "Energia",
    short: "Energia",
    prompt: "Ile masz dziś energii?",
    levels: ["Brak", "Mało", "Średnio", "Dużo", "Pełnia"],
  },
  {
    key: "mood",
    label: "Samopoczucie",
    short: "Nastrój",
    prompt: "Jak się dziś czujesz?",
    levels: [
      MOOD_LABELS[1],
      MOOD_LABELS[2],
      MOOD_LABELS[3],
      MOOD_LABELS[4],
      MOOD_LABELS[5],
    ],
  },
  {
    key: "productivity",
    label: "Produktywność",
    short: "Zrobione",
    prompt: "Ile udało się dziś zrobić?",
    levels: ["Nic", "Mało", "Średnio", "Dużo", "Bardzo dużo"],
  },
  {
    key: "stress",
    label: "Poziom stresu",
    short: "Stres",
    prompt: "Jak duży masz dziś stres?",
    levels: ["Spokój", "Lekki", "Średni", "Duży", "Silny"],
    inverted: true,
  },
];

/** Szybki dostęp do definicji metryki po kluczu. */
export const METRIC_BY_KEY = METRICS.reduce(
  (acc, metric) => {
    acc[metric.key] = metric;
    return acc;
  },
  {} as Record<MetricKey, MetricDef>
);

/** Etykieta słowna danej wartości metryki (np. „Dobrze"). */
export function metricLevelLabel(key: MetricKey, value: Scale): string {
  return METRIC_BY_KEY[key].levels[value - 1];
}

/**
 * Czy wartość metryki zasługuje na uwagę (dane mówią kierunkiem): zwykła
 * metryka na dole skali (1–2), odwrócona — stres — na górze (4–5).
 */
export function needsAttention(key: MetricKey, value: Scale): boolean {
  return METRIC_BY_KEY[key].inverted ? value >= 4 : value <= 2;
}

/**
 * Średnia wartości danej metryki w zbiorze wpisów. Pomija wpisy bez tej metryki.
 * Zwraca null, gdy żaden wpis jej nie ma.
 */
export function averageMetric(entries: Entry[], key: MetricKey): number | null {
  const values = entries
    .map((entry) => entry[key])
    .filter((value): value is Scale => typeof value === "number");
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}
