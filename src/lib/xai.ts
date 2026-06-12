// Reużywalny helper wywołania xAI (Grok 4.3) bez streamingu — zwraca gotową,
// pełną treść odpowiedzi. Klucz `XAI_API_KEY` jest zmienną SERWEROWĄ. Trasa
// `/api/therapist` ma własną logikę „efektu pisania"; tutaj zwracamy czysty
// tekst, używany przez endpoint `/api/v1/agent` (odpowiedź JSON).

const XAI_URL = "https://api.x.ai/v1/chat/completions";
// Aktualny flagowiec xAI (zob. komentarz w src/app/api/therapist/route.ts).
const MODEL = "grok-4.3";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Błąd wywołania xAI z kodem HTTP do zmapowania na odpowiedź endpointu. */
export class XaiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "XaiError";
  }
}

/**
 * Wysyła komplet wiadomości do xAI i zwraca treść odpowiedzi modelu.
 * Rzuca `XaiError` (z kodem 503/502), gdy brak klucza lub usługa zawiedzie.
 */
export async function askXai(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new XaiError("Brak XAI_API_KEY — agent niedostępny.", 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        reasoning_effort: "low",
      }),
    });
  } catch (err) {
    console.error("[xai] fetch failed:", err);
    throw new XaiError("Nie udało się połączyć z usługą agenta.", 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("[xai] upstream error:", upstream.status, detail);
    throw new XaiError("Zapytanie do agenta nie powiodło się.", 502);
  }

  let content = "";
  try {
    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    content = data.choices?.[0]?.message?.content ?? "";
  } catch {
    content = "";
  }

  if (!content) {
    throw new XaiError("Pusta odpowiedź modelu.", 502);
  }

  return content;
}
