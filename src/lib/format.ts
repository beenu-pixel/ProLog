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

/** Miesiąc i rok po polsku, np. „czerwiec 2026". */
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });
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
