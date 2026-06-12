import { supabaseAdmin } from "@/lib/supabase-admin";
import { isValidDayKey, todayWarsaw } from "@/lib/api-day";
import { rowToEntry, type EntryRow } from "@/lib/api-entry";
import { ApiError } from "@/lib/api-error";
import { buildJournalContext } from "@/lib/therapist-context";
import { FREUD } from "@/lib/therapists";
import { askXai, XaiError, type ChatMessage } from "@/lib/xai";
import { formatWeekday } from "@/lib/format";

// Serwis agenta — pytanie do cyfrowego terapeuty (Freud) nad dziennikiem.
// Jedna implementacja używana przez REST (/api/v1/agent) i przez narzędzie MCP.
// Kontekst: pełny dziennik użytkownika + nota o dniu/okresie skupienia.
// Historia rozmów jest prowadzona PER DZIEŃ (tabela agent_chat_messages).

/** Krótka nota „skupienia": na którym dniu (i ewentualnie okresie) się koncentrujemy. */
function buildFocusNote(day: string, from?: string, to?: string): string {
  const lines = [
    "KONTEKST PYTANIA (z zewnętrznego API):",
    `Dzień, na którym skupia się użytkownik: ${day} (${formatWeekday(day)}).`,
    `Data dzisiejsza: ${todayWarsaw()}.`,
  ];
  if (from && to) {
    lines.push(`Pytanie dotyczy też okresu: od ${from} do ${to}.`);
  } else if (from) {
    lines.push(`Pytanie dotyczy też okresu od: ${from}.`);
  } else if (to) {
    lines.push(`Pytanie dotyczy też okresu do: ${to}.`);
  }
  lines.push(
    "Gdy pytanie jest ogólnikowe, odnoś się przede wszystkim do wskazanego dnia/okresu; przy pytaniach ogólnych korzystaj z całej historii."
  );
  return lines.join("\n");
}

/**
 * Zadaje pytanie agentowi w imieniu użytkownika i zwraca `{ answer, day }`.
 * Rzuca `ApiError` przy złych danych (400), błędzie odczytu dziennika (500)
 * lub błędzie usługi modelu (status z `XaiError`, domyślnie 502).
 */
export async function askAgent(
  userId: string,
  input: Record<string, unknown>
): Promise<{ answer: string; day: string }> {
  const question = input.question;
  if (typeof question !== "string" || question.trim() === "") {
    throw new ApiError(400, "Pole `question` jest wymagane (niepusty tekst).");
  }

  // Dzień skupienia + opcjonalny zakres — walidacja formatu, gdy podane.
  let day = todayWarsaw();
  if (input.day !== undefined) {
    if (!isValidDayKey(input.day)) {
      throw new ApiError(400, "Pole `day` musi mieć format YYYY-MM-DD.");
    }
    day = input.day;
  }
  for (const key of ["from", "to"] as const) {
    if (input[key] !== undefined && !isValidDayKey(input[key])) {
      throw new ApiError(400, `Pole \`${key}\` musi mieć format YYYY-MM-DD.`);
    }
  }
  const from = input.from as string | undefined;
  const to = input.to as string | undefined;

  // Pełny dziennik użytkownika → kontekst dla modelu.
  const { data: entryRows, error: entriesError } = await supabaseAdmin!
    .from("entries")
    .select("*")
    .eq("user_id", userId);
  if (entriesError) {
    console.error("[services/agent] entries select failed:", entriesError);
    throw new ApiError(500, "Nie udało się pobrać dziennika.");
  }
  const entries = (entryRows as EntryRow[]).map(rowToEntry);
  const journalContext = buildJournalContext(entries);

  // Historia rozmowy z tego dnia (per dzień).
  const { data: historyRows } = await supabaseAdmin!
    .from("agent_chat_messages")
    .select("role, content")
    .eq("user_id", userId)
    .eq("day", day)
    .order("created_at", { ascending: true });

  const history: ChatMessage[] = (historyRows ?? []).map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content as string,
  }));

  const focusNote = buildFocusNote(day, from, to);
  const messages: ChatMessage[] = [
    { role: "system", content: FREUD.systemPrompt },
    { role: "system", content: journalContext },
    ...history,
    { role: "user", content: `${focusNote}\n\n---\n\n${question}` },
  ];

  let answer: string;
  try {
    answer = await askXai(messages);
  } catch (err) {
    const status = err instanceof XaiError ? err.status : 502;
    const message = err instanceof XaiError ? err.message : "Błąd usługi agenta.";
    throw new ApiError(status, message);
  }

  // Zapis wymiany do historii dnia (best-effort — nie blokuje odpowiedzi błędem).
  const { error: insertError } = await supabaseAdmin!
    .from("agent_chat_messages")
    .insert([
      { user_id: userId, day, role: "user", content: question },
      { user_id: userId, day, role: "assistant", content: answer },
    ]);
  if (insertError) {
    console.error("[services/agent] history insert failed:", insertError);
  }

  return { answer, day };
}
