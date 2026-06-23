import { getTherapist } from "@/lib/therapists";
import { getUserPlan, isPersonaAllowed, ragDepth } from "@/lib/plans";
import { authenticateUser, isUserAuthError } from "@/lib/user-auth";
import { logAiUsage } from "@/lib/services/ai-usage";
import { hybridSearch } from "@/lib/services/search";
import { buildJournalContextFromHits } from "@/lib/therapist-context";
import {
  enforceRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  RateLimitError,
} from "@/lib/services/rate-limit";

// Strumieniowa rozmowa z cyfrowym terapeutą przez xAI (Grok 4.1 Fast). Klucz
// (XAI_API_KEY) jest zmienną SERWEROWĄ — nigdy nie trafia do przeglądarki,
// dlatego całe wywołanie xAI dzieje się tutaj.
//
// Dostęp tylko dla zalogowanych (weryfikacja sesji Supabase) — funkcja AI zużywa
// kredyty właściciela, więc każde wywołanie musi być przypisane do konta.
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
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

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
  const uiContext = body.uiContext ?? "";

  // Plan użytkownika steruje dostępem do person i głębią RAG.
  const plan = await getUserPlan(auth.userId);

  // Bramka person: na planie free dostępny jest tylko Freud. Sprawdzamy PRZED
  // rate-limitem, żeby zablokowana próba nie zżerała dziennej puli rozmów.
  if (!isPersonaAllowed(plan, therapist.id)) {
    return Response.json(
      {
        error: `Persona „${therapist.name}" jest dostępna w planie Pro.`,
        upgrade: true,
      },
      { status: 403 }
    );
  }

  let rl;
  try {
    rl = await enforceRateLimit(auth.userId, "therapist");
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
    throw err;
  }

  // RAG: kontekst dziennika budujemy SERWEROWO z wyszukiwania hybrydowego po treści
  // ostatniej wiadomości użytkownika (najtrafniejsze wpisy + zawsze ostatnie 7 dni).
  // Gdy wyszukiwanie/embedding padnie (np. brak OPENAI_API_KEY), wracamy do pełnego
  // kontekstu przysłanego przez klienta — czat działa jak dotąd (degradacja, nie awaria).
  const lastUserText = history[history.length - 1]?.content ?? "";
  let journalContext = body.journalContext ?? "";
  if (lastUserText.trim()) {
    try {
      // Głębia kontekstu zależy od planu: free = płytki (krótkie okno + mało trafień),
      // pro/max = pełna pamięć nad całym dziennikiem.
      const depth = ragDepth(plan);
      const hits = await hybridSearch(auth.userId, lastUserText, {
        recentDays: depth.recentDays,
        limit: depth.limit,
      });
      journalContext = buildJournalContextFromHits(hits);
    } catch (err) {
      console.error("[therapist] hybrid search failed — fallback to client context:", err);
    }
  }

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
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
  try {
    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    content = data.choices?.[0]?.message?.content ?? "";
    usage = data.usage;
  } catch {
    content = "";
  }

  if (!content) {
    return Response.json({ error: "Pusta odpowiedź modelu." }, { status: 502 });
  }

  // Log zużycia AI per użytkownik (best-effort, w tle).
  logAiUsage({
    userId: auth.userId,
    email: auth.email,
    endpoint: "therapist",
    model: MODEL,
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
  });

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
      ...rateLimitHeaders(rl),
    },
  });
}
