import { clearComposerText, getComposerText } from "@/lib/composer-text";
import { setDraft, textToHtml } from "@/lib/entry-draft";
import { playSound } from "@/lib/sound";

/**
 * Wspólny początek „Nowego wpisu” dla każdego wejścia (zakładka na dole, przycisk
 * w pasku bocznym, zaproszenie pustego dnia): tekst czekający w polu pisania
 * idzie do kreatora jako wersja robocza, żeby nie zgubić pracy użytkownika.
 */
export function startNewEntry(): void {
  const pending = getComposerText().trim();
  if (pending) {
    setDraft(textToHtml(pending));
    clearComposerText();
  }
  playSound("entry-new");
}
