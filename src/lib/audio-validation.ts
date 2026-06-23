// Walidacja przesłanego pliku audio dla /api/transcribe — wydzielona jako czysta
// funkcja (bez Request/Response), żeby dało się ją testować jednostkowo i żeby
// route handler pozostał czytelny. Sprawdzamy rozmiar i typ MIME PRZED wysłaniem do
// Groq — bez tego ktoś zalogowany mógłby pompować duże/nie-audio pliki, zużywając
// kredyty właściciela.

/** Górny limit rozmiaru pliku audio (25 MB) — zgodny z limitem Whisper w Groq. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Odrzucenie pliku: kod HTTP + komunikat (PL) do zwrócenia z route handlera. */
export interface AudioRejection {
  status: number;
  message: string;
}

/**
 * Sprawdza plik audio. Zwraca `null`, gdy plik jest akceptowalny, albo `AudioRejection`
 * (413 dla zbyt dużego, 400 dla nie-audio). Pusty `type` przepuszczamy — niektóre
 * przeglądarki nie ustawiają MIME przy nagraniu z MediaRecorder.
 */
export function validateAudioFile(file: {
  size: number;
  type: string;
}): AudioRejection | null {
  if (file.size > MAX_AUDIO_BYTES) {
    return { status: 413, message: "Plik audio jest za duży (maks. 25 MB)." };
  }
  if (file.type && !file.type.startsWith("audio/")) {
    return { status: 400, message: "Wymagany plik audio." };
  }
  return null;
}
