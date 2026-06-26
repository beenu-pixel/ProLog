import { recentDaysRangeUtc } from "@/lib/api-day";
import { getEntriesByDateRange } from "@/lib/services/cms-entries";
import { buildJournalContext } from "@/lib/therapist-context";
import { ApiError } from "@/lib/api-error";
import type { ReportPeriod } from "@/lib/plans";

// Generowanie raportu nastroju i wątków za okres (tydzień / miesiąc) — funkcja
// premium (Pro/Max). Zbiera wszystkie wpisy z okna czasowego, buduje z nich kontekst
// (ten sam format co dla terapeuty) i prosi xAI o analityczne, ciepłe podsumowanie.
// Bramkowanie planu robi endpoint (/api/reports) — tu skupiamy się na treści.

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const MODEL = "grok-4.3";

// Ile dni wstecz obejmuje okres raportu (kalendarzowo, Europe/Warsaw).
const PERIOD_DAYS: Record<ReportPeriod, number> = { week: 7, month: 30 };
const PERIOD_LABEL: Record<ReportPeriod, string> = {
  week: "ostatni tydzień",
  month: "ostatni miesiąc",
};

const SYSTEM_PROMPT = `Jesteś wnikliwym, ciepłym analitykiem dziennika ProLog. Tworzysz dla użytkownika osobisty raport za wskazany okres na podstawie jego wpisów. Piszesz po polsku, zwracasz się na „ty".

CO MASZ ZROBIĆ
- Podsumuj ogólny nastrój okresu i jak się zmieniał w czasie (początek vs koniec, wzloty i spadki).
- Wskaż korelacje między metrykami (np. sen a nastrój, stres a produktywność, energia a samopoczucie) — tylko jeśli realnie widać je w danych.
- Nazwij powracające motywy i tematy z treści wpisów; odwołuj się do konkretnych dni po dacie.
- Zakończ 1–2 łagodnymi, praktycznymi spostrzeżeniami lub pytaniami do refleksji.

JAK PISZESZ
- Ciepło, konkretnie, bez moralizowania i bez pustych ogólników. Opierasz się WYŁĄCZNIE na dostarczonych wpisach — nie zmyślasz wpisów ani faktów.
- Zwykła proza w 3–5 krótkich akapitach. BEZ nagłówków i wypunktowań (interfejs ich nie renderuje). Lekki markdown (pogrubienia, kursywa) dozwolony.
- Metryki są w skali 1–5.`;

export interface ReportResult {
  period: ReportPeriod;
  /** Liczba wpisów w oknie czasowym. */
  entryCount: number;
  /** Wygenerowane podsumowanie (proza). */
  summary: string;
  /** Zużycie tokenów (do logu), gdy model był wołany. */
  usage?: { inputTokens: number | null; outputTokens: number | null };
}

/**
 * Buduje raport za okres dla użytkownika. Pobiera wpisy z okna (tydzień/miesiąc),
 * a gdy brak — zwraca krótką informację bez wołania modelu (oszczędność kosztu).
 * Rzuca `ApiError` przy braku konfiguracji serwera / klucza xAI lub błędzie modelu.
 */
export async function generateReport(
  userId: string,
  period: ReportPeriod
): Promise<ReportResult> {
  const { startUtc, endUtc } = recentDaysRangeUtc(PERIOD_DAYS[period]);
  let entries;
  try {
    entries = await getEntriesByDateRange(userId, startUtc, endUtc);
  } catch (err) {
    console.error("[services/reports] pobranie wpisów (Strapi) nieudane:", err);
    throw new ApiError(502, "Nie udało się pobrać wpisów do raportu.");
  }

  if (entries.length === 0) {
    return {
      period,
      entryCount: 0,
      summary: `W tym okresie (${PERIOD_LABEL[period]}) nie masz jeszcze wpisów, więc nie ma czego podsumować. Dodaj kilka wpisów i wróć po raport.`,
    };
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, "Brak XAI_API_KEY — raporty niedostępne.");
  }

  const journalContext = buildJournalContext(entries);
  const userPrompt = `Przygotuj raport za ${PERIOD_LABEL[period]} na podstawie poniższych wpisów.\n\n${journalContext}`;

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
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        reasoning_effort: "low",
      }),
    });
  } catch (err) {
    console.error("[services/reports] xAI fetch nieudany:", err);
    throw new ApiError(502, "Nie udało się połączyć z usługą raportów.");
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("[services/reports] xAI zwróciło błąd:", upstream.status, detail);
    throw new ApiError(502, "Generowanie raportu nie powiodło się.");
  }

  let summary = "";
  let usage: { inputTokens: number | null; outputTokens: number | null } = {
    inputTokens: null,
    outputTokens: null,
  };
  try {
    const json = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    summary = json.choices?.[0]?.message?.content?.trim() ?? "";
    usage = {
      inputTokens: json.usage?.prompt_tokens ?? null,
      outputTokens: json.usage?.completion_tokens ?? null,
    };
  } catch {
    summary = "";
  }

  if (!summary) {
    throw new ApiError(502, "Pusty raport z modelu.");
  }

  return { period, entryCount: entries.length, summary, usage };
}
