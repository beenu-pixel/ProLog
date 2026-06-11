import { supabase, isConfigured } from "@/lib/supabase";

// Trwałość rozmów z terapeutą. localStorage jest źródłem prawdy dla UI (jak przy
// wpisach), a po zalogowaniu każda wiadomość jest dodatkowo mirrorowana do
// Supabase pod `user_id`. Mirror jest fire-and-forget — nigdy nie blokuje UI ani
// nie rzuca wyjątkiem; bez sesji/konfiguracji to no-op.

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const KEY_PREFIX = "prolog.therapist.history.";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function localKey(therapistId: string): string {
  return KEY_PREFIX + therapistId;
}

/** Historia z localStorage (pusta, gdy brak/uszkodzona). */
export function loadLocal(therapistId: string): ChatMessage[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(localKey(therapistId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(therapistId: string, messages: ChatMessage[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(localKey(therapistId), JSON.stringify(messages));
  } catch {
    // brak dostępu do localStorage — pomijamy
  }
}

// --- Mirror do Supabase ----------------------------------------------------

// Cache id rozmowy per (user, therapist), by nie pytać bazy przy każdej wiadomości.
const conversationCache = new Map<string, string>();

function cacheKey(userId: string, therapistId: string): string {
  return `${userId}:${therapistId}`;
}

async function currentUserId(): Promise<string | null> {
  if (!isConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Znajduje istniejącą rozmowę (bez tworzenia). */
async function getConversationId(
  userId: string,
  therapistId: string
): Promise<string | null> {
  const key = cacheKey(userId, therapistId);
  const cached = conversationCache.get(key);
  if (cached) return cached;
  const { data } = await supabase!
    .from("therapist_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("therapist_id", therapistId)
    .maybeSingle();
  if (data?.id) {
    conversationCache.set(key, data.id as string);
    return data.id as string;
  }
  return null;
}

/** Znajduje lub tworzy rozmowę (upsert po unikalnym (user_id, therapist_id)). */
async function ensureConversationId(
  userId: string,
  therapistId: string
): Promise<string | null> {
  const existing = await getConversationId(userId, therapistId);
  if (existing) return existing;
  const { data, error } = await supabase!
    .from("therapist_conversations")
    .upsert(
      {
        user_id: userId,
        therapist_id: therapistId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,therapist_id" }
    )
    .select("id")
    .single();
  if (error || !data) return null;
  conversationCache.set(cacheKey(userId, therapistId), data.id as string);
  return data.id as string;
}

function pushMessageRemote(therapistId: string, message: ChatMessage): void {
  void (async () => {
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const conversationId = await ensureConversationId(userId, therapistId);
      if (!conversationId) return;
      await supabase!.from("therapist_messages").upsert({
        id: message.id,
        conversation_id: conversationId,
        user_id: userId,
        role: message.role,
        content: message.content,
        created_at: message.createdAt,
      });
    } catch {
      // Mirror to najlepszy wysiłek — błąd sieci nie może psuć zapisu lokalnego.
    }
  })();
}

// --- API publiczne ---------------------------------------------------------

/**
 * Zapisuje pojedynczą wiadomość: lokalnie (upsert po `id`) i — gdy zalogowany —
 * mirrorem do Supabase. Wołane przy wysłaniu wiadomości użytkownika oraz po
 * zakończeniu strumienia odpowiedzi (z finalną treścią).
 */
export function persistMessage(therapistId: string, message: ChatMessage): void {
  const existing = loadLocal(therapistId);
  const next = existing.some((m) => m.id === message.id)
    ? existing.map((m) => (m.id === message.id ? message : m))
    : [...existing, message];
  saveLocal(therapistId, next);
  pushMessageRemote(therapistId, message);
}

/**
 * Wczytuje historię rozmowy. Zalogowany → z Supabase (i kopia do localStorage
 * na offline); niezalogowany lub błąd → z localStorage. Best-effort.
 */
export async function loadHistory(therapistId: string): Promise<ChatMessage[]> {
  const local = loadLocal(therapistId);
  try {
    const userId = await currentUserId();
    if (!userId) return local;
    const conversationId = await getConversationId(userId, therapistId);
    if (!conversationId) return local;
    const { data, error } = await supabase!
      .from("therapist_messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error || !data) return local;
    const remote: ChatMessage[] = data.map((r) => ({
      id: r.id as string,
      role: r.role as ChatMessage["role"],
      content: r.content as string,
      createdAt: r.created_at as string,
    }));
    if (remote.length > 0) saveLocal(therapistId, remote);
    return remote.length > 0 ? remote : local;
  } catch {
    return local;
  }
}

/** Czyści historię rozmowy lokalnie i (gdy zalogowany) w Supabase. */
export function clearHistory(therapistId: string): void {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(localKey(therapistId));
    } catch {
      // pomijamy
    }
  }
  void (async () => {
    try {
      const userId = await currentUserId();
      if (!userId) return;
      // Usunięcie rozmowy kaskadowo kasuje jej wiadomości (ON DELETE CASCADE).
      await supabase!
        .from("therapist_conversations")
        .delete()
        .eq("user_id", userId)
        .eq("therapist_id", therapistId);
      conversationCache.delete(cacheKey(userId, therapistId));
    } catch {
      // jw. — usunięcie lokalne już się powiodło.
    }
  })();
}
