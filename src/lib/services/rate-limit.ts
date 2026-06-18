import { supabaseAdmin } from "@/lib/supabase-admin";
import { dayRangeUtc, todayWarsaw } from "@/lib/api-day";
import { ApiError } from "@/lib/api-error";

// Rate-limiting funkcji AI oparty o bazę. Model „jeden wiersz = jedno żądanie"
// (tabela public.rate_limit_hits): przy każdym wywołaniu dostawiamy „stempel",
// a limit sprawdzamy zliczając stemple w dwóch oknach:
//   • minutowym (rolling 60 s) — cichy bezpiecznik anty-pętla, niewidoczny w UI,
//   • dziennym (dzień kalendarzowy Europe/Warsaw, reset o północy) — limit
//     pokazywany i egzekwowany w UI.
// Zapis/odczyt kluczem sekretnym (RLS bez polityk). Best-effort na błędach infry:
// gdy zliczanie padnie, NIE blokujemy użytkownika (limiter nie może być źródłem awarii).

export type RateBucket = "transcribe" | "therapist" | "search" | "api_agent";

interface BucketLimits {
  perMinute: number;
  perDay: number;
}

// Zawór bezpieczeństwa (sufit kosztowy/abuse), nie quota produktowa — progi
// kilkukrotnie powyżej realnego użycia, by uczciwy użytkownik ich nie dotknął.
const LIMITS: Record<RateBucket, BucketLimits> = {
  therapist: { perMinute: 10, perDay: 60 },
  api_agent: { perMinute: 10, perDay: 60 },
  transcribe: { perMinute: 20, perDay: 200 },
  search: { perMinute: 20, perDay: 300 },
};

const MINUTE_MS = 60 * 1000;

/** Stan dziennego okna dla bucketa — do nagłówków odpowiedzi i `/api/limits`. */
export interface RateLimitInfo {
  bucket: RateBucket;
  /** Dzienny limit (sufit). */
  limit: number;
  /** Zużycie dzienne (wliczając bieżące żądanie po `enforceRateLimit`). */
  used: number;
  /** Pozostało do limitu (nigdy < 0). */
  remaining: number;
  /** ISO najbliższej północy Europe/Warsaw (kiedy licznik się wyzeruje). */
  resetAt: string;
}

/** Błąd przekroczenia limitu — niesie `info` (do nagłówków) i `scope` okna. */
export class RateLimitError extends ApiError {
  constructor(
    public readonly info: RateLimitInfo,
    public readonly scope: "minute" | "day"
  ) {
    super(
      429,
      scope === "minute"
        ? "Zbyt wiele żądań w krótkim czasie. Zwolnij na chwilę."
        : "Wykorzystano dzienny limit tej funkcji. Odnowi się o północy."
    );
    this.name = "RateLimitError";
  }
}

/** Nagłówki X-RateLimit-* (dzienne okno) do dołączenia do odpowiedzi. */
export function rateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(info.limit),
    "X-RateLimit-Remaining": String(info.remaining),
    "X-RateLimit-Reset": info.resetAt,
  };
}

/** Gotowa odpowiedź 429 z nagłówkami i strukturalnym ciałem (do zwrotu z trasy). */
export function rateLimitResponse(err: RateLimitError): Response {
  return Response.json(
    { error: err.message, scope: err.scope, resetAt: err.info.resetAt },
    { status: 429, headers: rateLimitHeaders(err.info) }
  );
}

/** Najbliższa północ Europe/Warsaw (koniec dziś) jako ISO. */
function resetAtIso(): string {
  return dayRangeUtc(todayWarsaw()).endUtc;
}

/** Permisywny stan (gdy infra zliczania padnie — nie blokujemy użytkownika). */
function permissiveInfo(bucket: RateBucket): RateLimitInfo {
  const limit = LIMITS[bucket].perDay;
  return { bucket, limit, used: 0, remaining: limit, resetAt: resetAtIso() };
}

/**
 * Rejestruje wywołanie i egzekwuje limit. Wstawia „stempel", zlicza okna minutowe
 * i dzienne; przy przekroczeniu rzuca `RateLimitError`. Zwraca stan dziennego okna.
 * Błędy infrastruktury są łykane (best-effort) — wtedy przepuszczamy żądanie.
 */
export async function enforceRateLimit(
  userId: string,
  bucket: RateBucket
): Promise<RateLimitInfo> {
  if (!supabaseAdmin) return permissiveInfo(bucket);

  const limits = LIMITS[bucket];
  const startOfDay = dayRangeUtc(todayWarsaw()).startUtc;
  const minuteAgo = new Date(Date.now() - MINUTE_MS).toISOString();

  try {
    // Stempel bieżącego żądania.
    const { error: insertError } = await supabaseAdmin
      .from("rate_limit_hits")
      .insert({ user_id: userId, bucket });
    if (insertError) {
      console.error("[rate-limit] insert failed:", insertError);
      return permissiveInfo(bucket);
    }

    // Sprzątanie starych stempli (best-effort, w tle) — tabela nie rośnie w nieskończoność.
    void supabaseAdmin
      .from("rate_limit_hits")
      .delete()
      .lt("created_at", new Date(Date.now() - 25 * 60 * MINUTE_MS).toISOString())
      .then(undefined, () => {
        // sprzątanie nie może wpływać na żądanie
      });

    // Stemple z dzisiejszej doby (PL) — z nich liczymy oba okna.
    const { data, error } = await supabaseAdmin
      .from("rate_limit_hits")
      .select("created_at")
      .eq("user_id", userId)
      .eq("bucket", bucket)
      .gte("created_at", startOfDay);
    if (error || !data) {
      console.error("[rate-limit] count failed:", error);
      return permissiveInfo(bucket);
    }

    const dayUsed = data.length;
    const minuteUsed = data.reduce(
      (n, row) => (row.created_at >= minuteAgo ? n + 1 : n),
      0
    );

    const info: RateLimitInfo = {
      bucket,
      limit: limits.perDay,
      used: dayUsed,
      remaining: Math.max(0, limits.perDay - dayUsed),
      resetAt: resetAtIso(),
    };

    if (minuteUsed > limits.perMinute) throw new RateLimitError(info, "minute");
    if (dayUsed > limits.perDay) throw new RateLimitError(info, "day");

    return info;
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    console.error("[rate-limit] unexpected:", err);
    return permissiveInfo(bucket);
  }
}

/**
 * Bieżący stan dziennych limitów per bucket BEZ rejestrowania wywołania — dla
 * `GET /api/limits`, by UI mogło wyłączyć przyciski zanim użytkownik coś kliknie.
 */
export async function getLimitsFor(
  userId: string
): Promise<Record<RateBucket, RateLimitInfo>> {
  const buckets = Object.keys(LIMITS) as RateBucket[];
  const resetAt = resetAtIso();

  const build = (used: Record<RateBucket, number>) =>
    Object.fromEntries(
      buckets.map((bucket) => {
        const limit = LIMITS[bucket].perDay;
        const u = used[bucket] ?? 0;
        return [
          bucket,
          { bucket, limit, used: u, remaining: Math.max(0, limit - u), resetAt },
        ];
      })
    ) as Record<RateBucket, RateLimitInfo>;

  const empty = Object.fromEntries(buckets.map((b) => [b, 0])) as Record<
    RateBucket,
    number
  >;

  if (!supabaseAdmin) return build(empty);

  try {
    const startOfDay = dayRangeUtc(todayWarsaw()).startUtc;
    const { data, error } = await supabaseAdmin
      .from("rate_limit_hits")
      .select("bucket")
      .eq("user_id", userId)
      .gte("created_at", startOfDay);
    if (error || !data) return build(empty);

    const used = { ...empty };
    for (const row of data as { bucket: RateBucket }[]) {
      if (row.bucket in used) used[row.bucket] += 1;
    }
    return build(used);
  } catch (err) {
    console.error("[rate-limit] getLimitsFor failed:", err);
    return build(empty);
  }
}
