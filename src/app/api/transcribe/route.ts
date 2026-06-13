import { NextResponse } from "next/server";

import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { logAiUsage } from "@/lib/services/ai-usage";

// Transkrypcja audio przez Groq (model Whisper large-v3-turbo). Klucz API
// (GROQ_API_KEY) jest zmienną SERWEROWĄ — nigdy nie trafia do przeglądarki,
// dlatego całe wywołanie Groq dzieje się tutaj, po stronie serwera.
//
// Dostęp tylko dla zalogowanych (weryfikacja sesji Supabase) — funkcja AI zużywa
// kredyty właściciela, więc każde wywołanie musi być przypisane do konta.
//
// API Groq jest zgodne z OpenAI (`/openai/v1/audio/transcriptions`), więc nie
// potrzebujemy dodatkowego SDK — wystarczy `fetch` i przekazanie pliku dalej.

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Brak GROQ_API_KEY — transkrypcja niedostępna." },
      { status: 503 }
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    // niepoprawne ciało żądania — obsłużone niżej
  }

  if (!file) {
    return NextResponse.json(
      { error: "Brak pliku audio w polu `file`." },
      { status: 400 }
    );
  }

  // Przekazujemy plik dalej do Groq pod oczekiwanymi przez Whisper parametrami.
  const upstream = new FormData();
  upstream.append("file", file, file.name || "audio.webm");
  upstream.append("model", MODEL);
  upstream.append("language", "pl");
  upstream.append("response_format", "json");

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: "Transkrypcja nie powiodła się.", detail },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { text?: string };
    // Whisper nie zwraca liczby tokenów — logujemy samo wywołanie (atrybucja konta).
    logAiUsage({ userId: auth.userId, email: auth.email, endpoint: "transcribe", model: MODEL });
    return NextResponse.json({ text: data.text ?? "" });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się połączyć z usługą transkrypcji." },
      { status: 502 }
    );
  }
}
