/** Formatuje datę ISO na czytelny zapis po polsku, np. „1 czerwca 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Numer dnia miesiąca z zerem wiodącym, np. „02" — duża liczba na liście. */
export function formatDayNumber(iso: string): string {
  return String(new Date(iso).getDate()).padStart(2, "0");
}

/** Dzień tygodnia po polsku, np. „wtorek". */
export function formatWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { weekday: "long" });
}

/** Skrót dnia tygodnia po polsku, np. „pon." — kafelek paska dni. */
export function formatWeekdayShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("pl-PL", { weekday: "short" });
}

/** Miesiąc i rok po polsku, np. „czerwiec 2026". */
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });
}

/** Godzina po polsku, np. „20:00". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Klucz dnia „YYYY-MM-DD" wg czasu lokalnego (stabilny do grupowania). */
export function dayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Początek tygodnia (poniedziałek, 00:00) dla danej daty. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // 0 = poniedziałek … 6 = niedziela
  d.setDate(d.getDate() - offset);
  return d;
}

/** Nowa data przesunięta o `n` dni. */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Czy dwie daty to ten sam dzień kalendarzowy. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Usuwa znaczniki HTML i skraca treść do podglądu na liście. */
export function toExcerpt(html: string, maxLength = 160): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}
