// Rozstrzyganie „dnia" wg strefy Europe/Warsaw, bez zewnętrznych bibliotek.
// Serwer działa zwykle w UTC, a użytkownik myśli w czasie polskim — dlatego
// granice doby i domyślne „dziś" liczymy wprost dla Europe/Warsaw, uwzględniając
// zmianę CET/CEST przez `Intl.DateTimeFormat`.

const TZ = "Europe/Warsaw";

/** Format „YYYY-MM-DD" (klucz dnia). */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Czy łańcuch to poprawny klucz dnia „YYYY-MM-DD" (z sensowną datą). */
export function isValidDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/**
 * Przesunięcie strefy Europe/Warsaw względem UTC (w ms) dla danego momentu.
 * Dodatnie (latem +2h, zimą +1h). Liczone przez sformatowanie instantu w PL i
 * potraktowanie tych liczb jak UTC.
 */
function warsawOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - date.getTime();
}

/**
 * Zamienia czas ścienny w Warszawie (dany dzień + godzina/minuta) na instant UTC.
 * Dwuprzebiegowo, by poprawnie trafić w okolice zmiany czasu.
 */
function warsawWallToUtc(day: string, hour: number, minute: number): Date {
  const [y, m, d] = day.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, hour, minute, 0);
  const offset = warsawOffsetMs(new Date(naive));
  let utc = naive - offset;
  const offset2 = warsawOffsetMs(new Date(utc));
  if (offset2 !== offset) utc = naive - offset2;
  return new Date(utc);
}

/** Dzisiejszy klucz dnia „YYYY-MM-DD" wg czasu polskiego. */
export function todayWarsaw(): string {
  // en-CA daje format „YYYY-MM-DD".
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/**
 * Granice doby (PL) jako instanty UTC do filtrowania `created_at`:
 * `startUtc <= created_at < endUtc`. `endUtc` to początek następnego dnia.
 */
export function dayRangeUtc(day: string): { startUtc: string; endUtc: string } {
  const start = warsawWallToUtc(day, 0, 0);
  const [y, m, d] = day.split("-").map(Number);
  const nextDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0))
  );
  const end = warsawWallToUtc(nextDay, 0, 0);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

/**
 * Instant UTC dla godziny 12:00 (PL) danego dnia. Tu zapisujemy `created_at`
 * nowego wpisu z API — środek dnia jest odporny na przeskoki strefy o północy
 * (grupowanie po `dayKey` w UI trafia we właściwą datę).
 */
export function noonUtcForDay(day: string): string {
  return warsawWallToUtc(day, 12, 0).toISOString();
}

/**
 * Granice UTC dla ostatnich `days` dni kalendarzowych Europe/Warsaw — dziś plus
 * `days - 1` poprzednich dni: `startUtc <= created_at < endUtc`. Używane przez
 * wyszukiwanie hybrydowe do dołączania kontekstu „ostatnich N dni". `days` jest
 * przycinane do co najmniej 1.
 */
export function recentDaysRangeUtc(days = 7): { startUtc: string; endUtc: string } {
  const span = Math.max(1, Math.floor(days));
  const today = todayWarsaw();
  const [y, m, d] = today.split("-").map(Number);
  // Klucz dnia startu = dziś − (span − 1). Liczymy w południe UTC, by przeskok
  // strefy o północy nie przesunął nas o dzień (wzorzec z `dayRangeUtc`).
  const startDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(Date.UTC(y, m - 1, d - (span - 1), 12, 0, 0))
  );
  return {
    startUtc: warsawWallToUtc(startDay, 0, 0).toISOString(),
    endUtc: dayRangeUtc(today).endUtc,
  };
}
