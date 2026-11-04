// Parser polskich określeń dat w wiadomości użytkownika → zakresy dni.
//
// Persona dostaje wpisy z wyszukiwania wektorowego (najtrafniejsze + ostatnie
// dni). Pytanie o konkretny okres („ile wpisów z lipca", „27–31.07", „wczoraj")
// wymaga jednak WSZYSTKICH wpisów z tego okresu, a wektor ich nie gwarantuje.
// Ten moduł wyłuskuje z tekstu zakresy dat, które serwer dociąga z bazy wprost.
//
// Czysty moduł (bez I/O): „dziś" przychodzi z zewnątrz jako klucz dnia
// Europe/Warsaw, dzięki czemu testy są deterministyczne. Zakresy są domknięte
// (`from` i `to` włącznie) w formacie „YYYY-MM-DD".

export interface DayRange {
  /** Pierwszy dzień zakresu (włącznie), „YYYY-MM-DD". */
  from: string;
  /** Ostatni dzień zakresu (włącznie), „YYYY-MM-DD". */
  to: string;
}

/** Ile zakresów maksymalnie bierzemy z jednej wiadomości (ochrona przed nadmiarem). */
export const MAX_RANGES = 3;

// ── Arytmetyka dni (UTC jako „kalendarz bez strefy") ────────────────────────

function toUtc(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Dzień przesunięty o `n` dni (może być ujemne). */
export function addDays(day: string, n: number): string {
  return fromUtc(toUtc(day) + n * 86_400_000);
}

/** Liczba dni w zakresie (włącznie z oboma końcami). */
export function rangeLength(range: DayRange): number {
  return Math.round((toUtc(range.to) - toUtc(range.from)) / 86_400_000) + 1;
}

/** Wszystkie dni zakresu po kolei. */
export function daysOf(range: DayRange): string[] {
  const out: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
  return out;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Klucz dnia z liczb albo `null`, gdy data nie istnieje (np. 31.02). */
function makeDay(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  if (day > lastDayOfMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Dzień tygodnia: 0 = poniedziałek … 6 = niedziela. */
function weekdayIndex(day: string): number {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7;
}

// ── Słowniki ─────────────────────────────────────────────────────────────────

/** Formy fleksyjne miesięcy (po zdjęciu znaków diakrytycznych) → numer miesiąca. */
const MONTH_FORMS: Record<string, number> = {};
const MONTH_STEMS: [number, string[]][] = [
  [1, ["styczen", "stycznia", "styczniu", "styczniem"]],
  [2, ["luty", "lutego", "lutym"]],
  [3, ["marzec", "marca", "marcu", "marcem"]],
  [4, ["kwiecien", "kwietnia", "kwietniu", "kwietniem"]],
  [5, ["maj", "maja", "maju", "majem"]],
  [6, ["czerwiec", "czerwca", "czerwcu", "czerwcem"]],
  [7, ["lipiec", "lipca", "lipcu", "lipcem"]],
  [8, ["sierpien", "sierpnia", "sierpniu", "sierpniem"]],
  [9, ["wrzesien", "wrzesnia", "wrzesniu", "wrzesniem"]],
  [10, ["pazdziernik", "pazdziernika", "pazdzierniku", "pazdziernikiem"]],
  [11, ["listopad", "listopada", "listopadzie", "listopadem"]],
  [12, ["grudzien", "grudnia", "grudniu", "grudniem"]],
];
for (const [month, forms] of MONTH_STEMS) for (const f of forms) MONTH_FORMS[f] = month;

const MONTH = `(${Object.keys(MONTH_FORMS)
  .sort((a, b) => b.length - a.length)
  .join("|")})`;
const YEAR = "(20\\d{2})";
/** Granica słowa dla liter łacińskich (po normalizacji tekst jest ASCII-owy). */
const L = "(?<![a-z0-9])";
const R = "(?![a-z0-9])";
const DASH = "\\s*(?:-|do)\\s*";

const NUMBER_WORDS: Record<string, number> = {
  dwa: 2, dwoch: 2, dwu: 2, trzy: 3, trzech: 3, cztery: 4, czterech: 4,
  piec: 5, pieciu: 5, szesc: 6, szesciu: 6, siedem: 7, siedmiu: 7,
  osiem: 8, osmiu: 8, dziewiec: 9, dziewieciu: 9, dziesiec: 10, dziesieciu: 10,
  czternascie: 14, czternastu: 14, trzydziesci: 30, trzydziestu: 30,
};
const COUNT = `(\\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})`;

const WEEKDAYS: [number, string[]][] = [
  [0, ["poniedzialek", "poniedzialku"]],
  [1, ["wtorek", "wtorku"]],
  [2, ["sroda", "srode", "srody", "srodzie"]],
  [3, ["czwartek", "czwartku"]],
  [4, ["piatek", "piatku"]],
  [5, ["sobota", "sobote", "soboty", "sobocie"]],
  [6, ["niedziela", "niedziele", "niedzieli"]],
];
const WEEKDAY_FORMS: Record<string, number> = {};
for (const [idx, forms] of WEEKDAYS) for (const f of forms) WEEKDAY_FORMS[f] = idx;
const WEEKDAY = `(${Object.keys(WEEKDAY_FORMS)
  .sort((a, b) => b.length - a.length)
  .join("|")})`;

// ── Normalizacja ─────────────────────────────────────────────────────────────

/**
 * Małe litery, bez polskich znaków (ł→l, ą→a…), myślniki ujednolicone do „-".
 * Długość tekstu się nie zmienia (pozycje dopasowań pokrywają się z oryginałem),
 * bo każdy znak diakrytyczny w NFC zamienia się na dokładnie jedną literę.
 */
function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—−]/g, "-");
}

// ── Parser ───────────────────────────────────────────────────────────────────

interface Ctx {
  today: string;
  year: number;
}

/**
 * Rok dla daty bez roku: bieżący, a gdy taki dzień jeszcze nie nadszedł —
 * poprzedni (dziennik opisuje przeszłość, więc „w grudniu" w listopadzie
 * znaczy zeszły grudzień).
 */
function inferYear(ctx: Ctx, month: number, day = 1): number {
  const candidate = makeDay(ctx.year, month, Math.min(day, lastDayOfMonth(ctx.year, month)));
  return candidate && candidate > ctx.today ? ctx.year - 1 : ctx.year;
}

function monthRange(year: number, month: number): DayRange {
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
  };
}

function countValue(raw: string): number {
  return /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw] ?? 0;
}

type Rule = {
  re: RegExp;
  /** Zwraca zakres albo `null` (np. data nieistniejąca → dopasowanie ignorujemy). */
  build: (m: RegExpExecArray, ctx: Ctx, original: string) => DayRange | null;
};

function single(day: string | null): DayRange | null {
  return day ? { from: day, to: day } : null;
}

function ordered(a: string | null, b: string | null): DayRange | null {
  if (!a || !b) return null;
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

// Kolejność ma znaczenie: dłuższe, bardziej szczegółowe wzorce idą pierwsze,
// a dopasowany fragment jest wymazywany, żeby „27–31 lipca 2026" nie dał
// dodatkowo „31 lipca" ani „lipca 2026".
const RULES: Rule[] = [
  // ISO: zakres i pojedynczy dzień.
  {
    re: new RegExp(`${L}(?:od\\s+)?(\\d{4})-(\\d{2})-(\\d{2})${DASH}(\\d{4})-(\\d{2})-(\\d{2})${R}`, "g"),
    build: (m) =>
      ordered(makeDay(+m[1], +m[2], +m[3]), makeDay(+m[4], +m[5], +m[6])),
  },
  {
    re: new RegExp(`${L}(\\d{4})-(\\d{2})-(\\d{2})${R}`, "g"),
    build: (m) => single(makeDay(+m[1], +m[2], +m[3])),
  },
  // Liczbowo: „27.07–02.08.2026", „27-31.07.2026", „od 27 do 31.07".
  {
    re: new RegExp(
      `${L}(?:od\\s+)?(\\d{1,2})\\.(\\d{2})(?:\\.(\\d{4}))?${DASH}(\\d{1,2})\\.(\\d{2})(?:\\.(\\d{4}))?${R}`,
      "g"
    ),
    build: (m, ctx) => {
      const y2 = m[6] ? +m[6] : m[3] ? +m[3] : inferYear(ctx, +m[5], +m[4]);
      const y1 = m[3] ? +m[3] : y2;
      return ordered(makeDay(y1, +m[2], +m[1]), makeDay(y2, +m[5], +m[4]));
    },
  },
  {
    re: new RegExp(`${L}(?:od\\s+)?(\\d{1,2})${DASH}(\\d{1,2})\\.(\\d{2})(?:\\.(\\d{4}))?${R}`, "g"),
    build: (m, ctx) => {
      const year = m[4] ? +m[4] : inferYear(ctx, +m[3], +m[2]);
      return ordered(makeDay(year, +m[3], +m[1]), makeDay(year, +m[3], +m[2]));
    },
  },
  // Pojedynczy dzień liczbowo: „24.07.2026", „24.07", „24/07/2026". Pomijamy
  // godziny („o 8.10", „godz. 12.30") — dzień-miesiąc i godzina wyglądają tak samo.
  {
    re: new RegExp(`(?<!(?:^|\\s)o\\s)(?<!godz\\.?\\s)${L}(\\d{1,2})[./](\\d{2})(?:[./](\\d{4}))?${R}`, "g"),
    build: (m, ctx) => {
      const year = m[3] ? +m[3] : inferYear(ctx, +m[2], +m[1]);
      return single(makeDay(year, +m[2], +m[1]));
    },
  },
  // Słownie: „od 27 lipca do 2 sierpnia 2026", „27–31 lipca".
  {
    re: new RegExp(`${L}(?:od\\s+)?(\\d{1,2})\\s+${MONTH}(?:\\s+${YEAR})?${DASH}(\\d{1,2})\\s+${MONTH}(?:\\s+${YEAR})?${R}`, "g"),
    build: (m, ctx) => {
      const m1 = MONTH_FORMS[m[2]];
      const m2 = MONTH_FORMS[m[5]];
      const y2 = m[6] ? +m[6] : m[3] ? +m[3] : inferYear(ctx, m2, +m[4]);
      const y1 = m[3] ? +m[3] : m1 > m2 ? y2 - 1 : y2;
      return ordered(makeDay(y1, m1, +m[1]), makeDay(y2, m2, +m[4]));
    },
  },
  {
    re: new RegExp(`${L}(?:od\\s+)?(\\d{1,2})${DASH}(\\d{1,2})\\s+${MONTH}(?:\\s+${YEAR})?${R}`, "g"),
    build: (m, ctx) => {
      const month = MONTH_FORMS[m[3]];
      const year = m[4] ? +m[4] : inferYear(ctx, month, +m[2]);
      return ordered(makeDay(year, month, +m[1]), makeDay(year, month, +m[2]));
    },
  },
  // Tydzień miesiąca: „ostatni tydzień lipca", „drugi tydzień sierpnia 2026".
  {
    re: new RegExp(
      `${L}(pierwsz\\w*|drug\\w*|trzeci\\w*|czwart\\w*|piat\\w*|ostatni\\w*)\\s+(?:tydzien|tygodni\\w*)\\s+${MONTH}(?:\\s+${YEAR})?${R}`,
      "g"
    ),
    build: (m, ctx) => {
      const month = MONTH_FORMS[m[2]];
      const year = m[3] ? +m[3] : inferYear(ctx, month);
      const last = lastDayOfMonth(year, month);
      const which = m[1];
      if (which.startsWith("ostatni")) {
        return ordered(makeDay(year, month, last - 6), makeDay(year, month, last));
      }
      const n = which.startsWith("pierwsz") ? 0 : which.startsWith("drug") ? 1
        : which.startsWith("trzeci") ? 2 : which.startsWith("czwart") ? 3 : 4;
      const start = 1 + n * 7;
      if (start > last) return null;
      return ordered(makeDay(year, month, start), makeDay(year, month, Math.min(start + 6, last)));
    },
  },
  // Część miesiąca: „początek lipca", „w połowie sierpnia", „koniec lipca".
  {
    re: new RegExp(
      `${L}(poczat\\w*|polow\\w*|srod(?:ek|ka|ku)|kon(?:iec|ca|cu|cem))\\s+${MONTH}(?:\\s+${YEAR})?${R}`,
      "g"
    ),
    build: (m, ctx) => {
      const month = MONTH_FORMS[m[2]];
      const year = m[3] ? +m[3] : inferYear(ctx, month);
      const last = lastDayOfMonth(year, month);
      const part = m[1];
      const [a, b] = part.startsWith("poczat") ? [1, 10]
        : part.startsWith("kon") ? [21, last] : [11, 20];
      return ordered(makeDay(year, month, a), makeDay(year, month, b));
    },
  },
  // Dzień słownie: „24 lipca 2026", „24 lipca".
  {
    re: new RegExp(`${L}(\\d{1,2})\\s+${MONTH}(?:\\s+${YEAR})?${R}`, "g"),
    build: (m, ctx) => {
      const month = MONTH_FORMS[m[2]];
      const year = m[3] ? +m[3] : inferYear(ctx, month, +m[1]);
      return single(makeDay(year, month, +m[1]));
    },
  },
  // Cały miesiąc: „lipiec 2026", „w lipcu", „z lipca". „mają" (czasownik) po
  // zdjęciu ogonków wygląda jak „maja" — odróżniamy po oryginalnym tekście.
  {
    re: new RegExp(`${L}${MONTH}(?:\\s+${YEAR})?${R}`, "g"),
    build: (m, ctx, original) => {
      const raw = original.slice(m.index, m.index + m[1].length).toLowerCase();
      if (raw === "mają" || raw === "maja" && !m[2] && !/(?:^|\s)(?:z|od|do|w|we|na|przez)\s+$/.test(
        original.slice(Math.max(0, m.index - 8), m.index).toLowerCase()
      )) {
        return null;
      }
      const month = MONTH_FORMS[m[1]];
      const year = m[2] ? +m[2] : inferYear(ctx, month);
      return monthRange(year, month);
    },
  },
  // Względne: najpierw dłuższe („przedwczoraj" przed „wczoraj").
  {
    re: new RegExp(`${L}przedwczoraj\\w*${R}`, "g"),
    build: (_m, ctx) => single(addDays(ctx.today, -2)),
  },
  {
    re: new RegExp(`${L}wczoraj\\w*${R}`, "g"),
    build: (_m, ctx) => single(addDays(ctx.today, -1)),
  },
  {
    re: new RegExp(`${L}(?:dzis|dzisiaj|dzisiejsz\\w*)${R}`, "g"),
    build: (_m, ctx) => single(ctx.today),
  },
  {
    re: new RegExp(`${L}ostatni\\w*\\s+${COUNT}\\s+(?:dni|dnia)${R}`, "g"),
    build: (m, ctx) => {
      const n = countValue(m[1]);
      return n >= 1 ? { from: addDays(ctx.today, -(n - 1)), to: ctx.today } : null;
    },
  },
  {
    re: new RegExp(`${L}ostatni\\w*\\s+${COUNT}\\s+tygodni\\w*${R}`, "g"),
    build: (m, ctx) => {
      const n = countValue(m[1]);
      return n >= 1 ? { from: addDays(ctx.today, -(n * 7 - 1)), to: ctx.today } : null;
    },
  },
  {
    re: new RegExp(`${L}(?:ten|tym|biezac\\w*)\\s+(?:tydzien|tygodni\\w*)${R}`, "g"),
    build: (_m, ctx) => ({ from: addDays(ctx.today, -weekdayIndex(ctx.today)), to: ctx.today }),
  },
  {
    re: new RegExp(`${L}(?:zeszl\\w*|poprzedni\\w*|ubiegl\\w*)\\s+(?:tydzien|tygodni\\w*)${R}`, "g"),
    build: (_m, ctx) => {
      const monday = addDays(ctx.today, -weekdayIndex(ctx.today) - 7);
      return { from: monday, to: addDays(monday, 6) };
    },
  },
  {
    // „ostatni tydzień" bez nazwy miesiąca = ostatnie 7 dni.
    re: new RegExp(`${L}ostatni\\w*\\s+(?:tydzien|tygodni\\w*)${R}`, "g"),
    build: (_m, ctx) => ({ from: addDays(ctx.today, -6), to: ctx.today }),
  },
  {
    re: new RegExp(`${L}(?:ten|tym|biezac\\w*)\\s+miesiac\\w*${R}`, "g"),
    build: (_m, ctx) => ({ from: `${ctx.today.slice(0, 8)}01`, to: ctx.today }),
  },
  {
    re: new RegExp(`${L}(?:zeszl\\w*|poprzedni\\w*|ubiegl\\w*)\\s+miesiac\\w*${R}`, "g"),
    build: (_m, ctx) => {
      const [y, mo] = ctx.today.split("-").map(Number);
      return mo === 1 ? monthRange(y - 1, 12) : monthRange(y, mo - 1);
    },
  },
  {
    re: new RegExp(`${L}ostatni\\w*\\s+miesiac\\w*${R}`, "g"),
    build: (_m, ctx) => ({ from: addDays(ctx.today, -29), to: ctx.today }),
  },
  {
    re: new RegExp(`${L}(?:ten|tym|biezac\\w*)\\s+rok\\w*${R}`, "g"),
    build: (_m, ctx) => ({ from: `${ctx.year}-01-01`, to: ctx.today }),
  },
  {
    re: new RegExp(`${L}(?:zeszl\\w*|poprzedni\\w*|ubiegl\\w*)\\s+rok\\w*${R}`, "g"),
    build: (_m, ctx) => ({ from: `${ctx.year - 1}-01-01`, to: `${ctx.year - 1}-12-31` }),
  },
  // Dzień tygodnia: „w środę" = ostatnia środa (dziś włącznie), „w zeszłą środę"
  // = środa poprzedniego tygodnia.
  {
    re: new RegExp(`${L}(?:(zeszl\\w*|poprzedni\\w*|ubiegl\\w*)\\s+)?${WEEKDAY}${R}`, "g"),
    build: (m, ctx) => {
      const target = WEEKDAY_FORMS[m[2]];
      if (m[1]) {
        const monday = addDays(ctx.today, -weekdayIndex(ctx.today) - 7);
        return single(addDays(monday, target));
      }
      const back = (weekdayIndex(ctx.today) - target + 7) % 7;
      return single(addDays(ctx.today, -back));
    },
  },
  // Rok: „w 2025", „w 2025 roku".
  {
    re: new RegExp(`${L}(?:w|we|z|ze)\\s+${YEAR}(?:\\s+r(?:oku|\\.)?)?${R}`, "g"),
    build: (m) => ({ from: `${m[1]}-01-01`, to: `${m[1]}-12-31` }),
  },
];

/**
 * Wyciąga z tekstu zakresy dni, o które pyta użytkownik. Zwraca co najwyżej
 * `MAX_RANGES` zakresów w kolejności wystąpienia, bez duplikatów. Zakresy
 * kończące się w przyszłości są przycinane do dziś, a całkiem przyszłe —
 * pomijane (dziennik nie ma wpisów z przyszłości).
 *
 * @param today klucz dnia „YYYY-MM-DD" wg Europe/Warsaw
 */
export function parsePolishDateRanges(text: string, today: string): DayRange[] {
  if (typeof text !== "string" || !text.trim()) return [];
  const ctx: Ctx = { today, year: Number(today.slice(0, 4)) };
  const original = text.normalize("NFC");
  let work = normalize(original);

  const found: { index: number; range: DayRange }[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    const matches: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(work)) !== null) {
      matches.push(m);
      if (m[0].length === 0) rule.re.lastIndex++;
    }
    for (const match of matches) {
      const range = rule.build(match, ctx, original);
      if (range) found.push({ index: match.index, range });
      // Wymazujemy dopasowanie (także odrzucone, np. „30 lutego"), by krótsze
      // wzorce nie złapały jego części i nie zrobiły z niego całego miesiąca.
      // Wyjątek: odrzucone „maja"/„mają" — to zwykłe słowo, nic tu nie wymazujemy.
      if (!range && rule.re.source.startsWith(`${L}${MONTH}`)) continue;
      work =
        work.slice(0, match.index) +
        " ".repeat(match[0].length) +
        work.slice(match.index + match[0].length);
    }
  }

  const out: DayRange[] = [];
  for (const { range } of found.sort((a, b) => a.index - b.index)) {
    if (range.from > today) continue;
    const clipped = range.to > today ? { from: range.from, to: today } : range;
    if (!out.some((r) => r.from === clipped.from && r.to === clipped.to)) out.push(clipped);
    if (out.length >= MAX_RANGES) break;
  }
  return out;
}
