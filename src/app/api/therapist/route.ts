import { getTherapist } from "@/lib/therapists";

// Strumieniowa rozmowa z cyfrowym terapeutą przez xAI (Grok 4.1 Fast). Klucz
// (XAI_API_KEY) jest zmienną SERWEROWĄ — nigdy nie trafia do przeglądarki,
// dlatego całe wywołanie xAI dzieje się tutaj.
//
// API xAI jest zgodne z OpenAI (`/v1/chat/completions`), więc nie potrzebujemy
// SDK — wystarczy `fetch`. Żądanie układamy warstwowo pod automatyczny cache
// xAI (stałe na początku, zmienne na końcu): persona → dziennik → historia →
// świeży kontekst UI → ostatnie pytanie. Z odpowiedzi SSE przekazujemy klientowi
// wyłącznie `delta.content` (tok myślenia modelu pozostaje ukryty).

const XAI_URL = "https://api.x.ai/v1/chat/completions";
// Model w jednym miejscu (łatwa zmiana). Aktualny flagowiec xAI (stan na czerwiec
// 2026): `grok-4.3` (1M kontekstu, $1,25/$2,50 za 1M — grosze za rozmowę dzięki
// taniemu cache wejścia). Legacy aliasy Grok 4.1 Fast i tak są do niego routowane,
// a konsola xAI udostępnia kredyty/model tylko jako 4.3.
const MODEL = "grok-4.3";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface TherapistRequest {
  therapistId?: string;
  messages?: ChatTurn[];
  journalContext?: string;
  uiContext?: string;
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Brak XAI_API_KEY — rozmowa z terapeutą niedostępna." },
      { status: 503 }
    );
  }

  let body: TherapistRequest;
  try {
    body = (await request.json()) as TherapistRequest;
  } catch {
    return Response.json({ error: "Niepoprawne ciało żądania." }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  if (history.length === 0) {
    return Response.json({ error: "Brak wiadomości." }, { status: 400 });
  }

  const therapist = getTherapist(body.therapistId ?? "");
  const journalContext = body.journalContext ?? "";
  const uiContext = body.uiContext ?? "";

  // Warstwy: persona+few-shot (stałe) → dziennik (półstałe) jako wiadomości
  // `system` na początku (cache'owalny prefiks), potem historia. Świeży kontekst
  // UI dołączamy do treści OSTATNIEJ wiadomości użytkownika — dzięki temu nie ma
  // roli `system` w środku rozmowy (maks. zgodność z OpenAI-compatible API xAI).
  const head = history.slice(0, -1);
  const last = history[history.length - 1];
  const lastWithUi: ChatTurn = uiContext
    ? { ...last, content: `${uiContext}\n\n---\n\n${last.content}` }
    : last;

  const messages = [
    { role: "system", content: therapist.systemPrompt },
    ...(journalContext ? [{ role: "system", content: journalContext }] : []),
    ...head,
    lastWithUi,
  ];

  let upstream: Response;
  try {
    upstream = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Bez streamingu (stream:false): w środowiskach z antywirusem/proxy
      // skanującym HTTPS strumień SSE bywa buforowany i nie dociera token po
      // tokenie — pełną odpowiedź pobieramy naraz (~5 s), a efekt „pisania"
      // odtwarzamy niżej po stronie serwera. `reasoning_effort: "low"` skraca
      // czas myślenia grok-4.3 przed odpowiedzią.
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        reasoning_effort: "low",
      }),
    });
  } catch (err) {
    console.error("[therapist] xAI fetch failed:", err);
    return Response.json(
      { error: "Nie udało się połączyć z usługą terapeuty." },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      { error: "Rozmowa nie powiodła się.", detail },
      { status: 502 }
    );
  }

  // Pełna odpowiedź (bez streamingu). `content` to widoczna treść; ewentualne
  // `reasoning_content` ignorujemy (tok myślenia pozostaje ukryty).
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
    return Response.json({ error: "Pusta odpowiedź modelu." }, { status: 502 });
  }

  // Efekt „pisania" odtwarzany lokalnie: mamy już całą treść, więc wysyłamy ją do
  // przeglądarki w drobnych porcjach (słowo po słowie) z małym opóźnieniem. Ruch
  // localhost→przeglądarka nie jest skanowany przez antywirus, więc dociera płynnie.
  const encoder = new TextEncoder();
  const chunks = content.match(/\S+\s*/g) ?? [content];
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
