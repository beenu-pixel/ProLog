import { isHapticsEnabled } from "@/lib/settings";

/**
 * Czy urządzenie w ogóle pozwala wibrować ze strony. Prawda na Androidzie;
 * Safari na iPhonie nie udostępnia tego API, a komputery zwykle nie mają silnika
 * wibracji, dlatego przełącznik w ustawieniach pojawia się tylko tu, gdzie działa.
 */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

/** Krótkie „puknięcie" po stuknięciu palcem. Bez wsparcia nic się nie dzieje. */
export function tapHaptic(): void {
  if (!canVibrate() || !isHapticsEnabled()) return;
  navigator.vibrate(10);
}
