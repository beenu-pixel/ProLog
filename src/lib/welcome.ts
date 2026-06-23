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

// Onboarding: po REJESTRACJI (nie zwykłym logowaniu) kierujemy raz na cennik,
// żeby nowy użytkownik zobaczył plany — potem może kontynuować za darmo. Flagę
// ustawiamy w momencie rejestracji; przeżywa w localStorage do pierwszego
// zalogowania (pokrywa też rejestrację z potwierdzeniem e-mail / OAuth), a punkt
// przekierowania ją „konsumuje" (jednorazowo).

const PRICING_ONBOARDING_KEY = "prolog.pricingOnboarding";

export function markPricingOnboarding(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRICING_ONBOARDING_KEY, "1");
  } catch {
    // Brak dostępu do localStorage — pomijamy (po prostu nie przekierujemy na cennik).
  }
}

/** Zwraca true gdy onboarding był zaznaczony i jednocześnie czyści flagę (one-shot). */
export function consumePricingOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending = window.localStorage.getItem(PRICING_ONBOARDING_KEY) === "1";
    if (pending) window.localStorage.removeItem(PRICING_ONBOARDING_KEY);
    return pending;
  } catch {
    return false;
  }
}
