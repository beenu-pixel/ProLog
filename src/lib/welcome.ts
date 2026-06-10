// Flaga „widziałem ekran powitalny" — pozwala wracającym użytkownikom (także po
// wybraniu „Wejdź bez konta") wchodzić od razu do dziennika, bez Welcome.

const WELCOME_SEEN_KEY = "prolog.welcomeSeen";

export function markWelcomeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    // Brak dostępu do localStorage — pomijamy.
  }
}

export function hasSeenWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
