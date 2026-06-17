/**
 * Trwała szerokość lewego panelu (master) w widoku dziennika na desktopie.
 * Użytkownik może przeciągać uchwyt na krawędzi panelu; wartość zapisujemy w
 * localStorage. Mobile tego nie używa — panel jest tam ukryty.
 *
 * Świadomie trzymamy to jako proste read/write (bez reaktywnego store) —
 * szerokością steruje lokalny stan komponentu układu, a localStorage służy
 * tylko do utrwalenia między sesjami.
 */

const KEY = "prolog.entriesSidebarWidth";

/** Domyślna szerokość (px) — stan „jak teraz". Dwuklik w uchwyt do niej wraca. */
export const SIDEBAR_DEFAULT = 340;
export const SIDEBAR_MIN = 260;
export const SIDEBAR_MAX = 560;

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)));
}

/** Odczyt zapisanej szerokości (lub domyślnej). Bezpieczny poza przeglądarką. */
export function readSidebarWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return SIDEBAR_DEFAULT;
    return clampSidebarWidth(Number(raw));
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

/** Zapis szerokości (clamp do granic). Best-effort. */
export function writeSidebarWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(clampSidebarWidth(width)));
  } catch {
    // brak dostępu do localStorage — pomijamy
  }
}
