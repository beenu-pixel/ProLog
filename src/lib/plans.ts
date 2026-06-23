import { supabaseAdmin } from "@/lib/supabase-admin";

// Centralna konfiguracja planów płatnych ProLog — JEDNO źródło prawdy dla
// bramkowania funkcji AI. Tu mieszka: jakie limity ma każdy plan, które persony
// są dostępne, jak głęboki jest kontekst RAG i jakie raporty są odblokowane.
//
// Plan użytkownika trzymamy w tabeli public.subscriptions (migracja
// 20260622100000). Brak wiersza / status != 'active' => plan darmowy.
//
// Filozofia: bramkujemy to, co KOSZTUJE (wywołania modeli AI). Sam dziennik
// (CRUD, zdjęcia, motyw, zwykłe wyszukiwanie) jest poza planami — działa dla
// wszystkich. Dlatego limity dzienne dla `free` to realne QUOTY produktowe, a dla
// `pro`/`max` raczej sufity bezpieczeństwa kilkukrotnie powyżej realnego użycia.

export type PlanTier = "free" | "pro" | "max";

export const PLAN_TIERS: readonly PlanTier[] = ["free", "pro", "max"] as const;

// Kubełki rate-limitera. `api_data` to lekki zawór anty-abuse na narzędziach
// danych REST/MCP (create_entry/read_entries) — NIE jest bramką planu (te same
// progi na każdym planie), bo dostępu do własnych danych nie zamykamy za paywallem.
export type RateBucket =
  | "transcribe"
  | "therapist"
  | "search"
  | "api_agent"
  | "api_data"
  | "reports";

/** Wszystkie kubełki rate-limitera (do iteracji w /api/limits). */
export const RATE_BUCKETS: readonly RateBucket[] = [
  "transcribe",
  "therapist",
  "search",
  "api_agent",
  "api_data",
  "reports",
] as const;

export interface BucketLimit {
  perMinute: number;
  perDay: number;
}

// Limity per plan i per kubełek. `perMinute` to bezpiecznik anty-pętla (podobny na
// wszystkich planach), `perDay` to widoczne w UI okno dzienne (reset o północy PL).
const PLAN_LIMITS: Record<PlanTier, Record<RateBucket, BucketLimit>> = {
  free: {
    // Rozmowy AI: free dostaje WSPÓLNĄ pulę 5/dzień dzieloną między czat z personą
    // (therapist) a ask_agent z REST/MCP — patrz SHARED_DAILY_GROUPS niżej.
    therapist: { perMinute: 5, perDay: 5 },
    api_agent: { perMinute: 5, perDay: 5 },
    transcribe: { perMinute: 10, perDay: 10 },
    search: { perMinute: 10, perDay: 20 },
    api_data: { perMinute: 30, perDay: 300 },
    // Raporty są poza planem free (gate reportsAccess) — limit nieosiągalny.
    reports: { perMinute: 1, perDay: 1 },
  },
  pro: {
    therapist: { perMinute: 10, perDay: 50 },
    api_agent: { perMinute: 10, perDay: 50 },
    transcribe: { perMinute: 20, perDay: 200 },
    search: { perMinute: 20, perDay: 300 },
    api_data: { perMinute: 60, perDay: 2000 },
    reports: { perMinute: 2, perDay: 10 },
  },
  max: {
    therapist: { perMinute: 20, perDay: 200 },
    api_agent: { perMinute: 20, perDay: 200 },
    transcribe: { perMinute: 40, perDay: 1000 },
    search: { perMinute: 40, perDay: 1000 },
    api_data: { perMinute: 120, perDay: 10000 },
    reports: { perMinute: 4, perDay: 30 },
  },
};

// Grupy kubełków, których DZIENNE zużycie liczymy RAZEM (wspólna pula). Na `free`
// czat z personą i ask_agent dzielą jedną pulę „rozmów AI" (5/dzień łącznie), żeby
// nie dało się obejść limitu przez przełączenie się z UI na API. Na pro/max pul nie
// łączymy (limity są wysokie i osobne). Kubełek spoza jakiejkolwiek grupy liczy się sam.
const SHARED_DAILY_GROUPS: Record<PlanTier, RateBucket[][]> = {
  free: [["therapist", "api_agent"]],
  pro: [],
  max: [],
};

/** Limit (per-minuta + dzienny) dla planu i kubełka. */
export function bucketLimit(plan: PlanTier, bucket: RateBucket): BucketLimit {
  return PLAN_LIMITS[plan][bucket];
}

/**
 * Zbiór kubełków, których dzienne zużycie liczymy razem z podanym (wspólna pula).
 * Zawsze zawiera sam `bucket`. Dla niezgrupowanych zwraca `[bucket]`.
 */
export function dailyCountBuckets(plan: PlanTier, bucket: RateBucket): RateBucket[] {
  const group = SHARED_DAILY_GROUPS[plan].find((g) => g.includes(bucket));
  return group ?? [bucket];
}

// ── Persony ────────────────────────────────────────────────────────────────────

// Free ma tylko domyślną personę (Freud); pozostałe persony są częścią Pro/Max.
const FREE_PERSONA_IDS: readonly string[] = ["freud"];

/** Czy dana persona (po id) jest dostępna na tym planie. */
export function isPersonaAllowed(plan: PlanTier, personaId: string): boolean {
  if (plan !== "free") return true;
  return FREE_PERSONA_IDS.includes(personaId);
}

// ── Głębia RAG ───────────────────────────────────────────────────────────────

export interface RagDepth {
  /** Szerokość okna „ostatnich dni" dołączanego zawsze do kontekstu. */
  recentDays: number;
  /** Ile najtrafniejszych wpisów (top-K po RRF) wciągamy z wyszukiwania. */
  limit: number;
}

/**
 * Głębia pamięci/kontekstu RAG wg planu. Free dostaje płytki kontekst (krótkie okno
 * + mało trafień), Pro/Max pełną pamięć nad całym dziennikiem.
 */
export function ragDepth(plan: PlanTier): RagDepth {
  return plan === "free"
    ? { recentDays: 7, limit: 8 }
    : { recentDays: 30, limit: 30 };
}

// ── Raporty (Faza 2) ─────────────────────────────────────────────────────────

export type ReportsAccess = "none" | "weekly" | "weekly+monthly";

/** Okres raportu. */
export type ReportPeriod = "week" | "month";

/** Jakie raporty odblokowuje plan. */
export function reportsAccess(plan: PlanTier): ReportsAccess {
  if (plan === "free") return "none";
  if (plan === "pro") return "weekly";
  return "weekly+monthly";
}

/**
 * Czy plan ma dostęp do raportu danego okresu: tygodniowy od Pro w górę, miesięczny
 * tylko Max. Free nie ma żadnych raportów.
 */
export function isReportPeriodAllowed(plan: PlanTier, period: ReportPeriod): boolean {
  const access = reportsAccess(plan);
  if (access === "none") return false;
  if (period === "week") return true;
  return access === "weekly+monthly";
}

// ── Mapowanie płatności Stripe → plan ────────────────────────────────────────

/**
 * Plan na podstawie kwoty płatności (w groszach) ze zdarzenia Stripe
 * `checkout.session.completed`. Mapujemy po KWOCIE zamiast po `price_id`, żeby nie
 * trzeba było ręcznie przepisywać identyfikatorów cen do kodu:
 *   39 zł / 390 zł (miesięczny/roczny) → pro, 79 zł / 790 zł → max.
 * Zwraca `null` dla nieznanej kwoty (webhook to wtedy loguje i ignoruje).
 * Gdy dojdą nowe ceny, wystarczy dopisać kwotę tutaj (albo przejść na `price_id`).
 */
export function tierForAmount(
  amountMinor: number | null | undefined
): Exclude<PlanTier, "free"> | null {
  switch (amountMinor) {
    case 3900:
    case 39000:
      return "pro";
    case 7900:
    case 79000:
      return "max";
    default:
      return null;
  }
}

// ── Rozwiązywanie planu użytkownika ──────────────────────────────────────────

/**
 * Plan użytkownika z public.subscriptions (kluczem sekretnym — pomija RLS).
 * Zwraca `free`, gdy: brak konfiguracji serwera, brak wiersza, status != 'active'
 * lub błąd infry. Zasada bezpieczeństwa: w razie wątpliwości NIGDY nie przyznajemy
 * planu płatnego przez pomyłkę.
 */
export async function getUserPlan(userId: string): Promise<PlanTier> {
  return (await getUserSubscription(userId)).tier;
}

/** Pełniejszy stan subskrypcji do UI (panel „Plan i płatności"). */
export interface UserSubscription {
  /** Efektywny plan (free, gdy brak wiersza lub status != active). */
  tier: PlanTier;
  /** Surowy status z bazy (active/canceled/past_due/incomplete) — do wyświetlenia. */
  status: string;
  /** Koniec bieżącego okresu rozliczeniowego (ISO) lub null. */
  currentPeriodEnd: string | null;
  /** Czy jest powiązany klient Stripe (→ można otworzyć portal zarządzania). */
  hasStripeCustomer: boolean;
  /** Czy subskrypcja jest zaplanowana do anulowania na koniec okresu. */
  cancelAtPeriodEnd: boolean;
}

/**
 * Subskrypcja użytkownika z public.subscriptions (kluczem sekretnym). Zwraca plan
 * `free`/aktywny przy braku wiersza, błędzie lub statusie != active — zgodnie z
 * zasadą „w razie wątpliwości nie przyznajemy płatnego".
 */
export async function getUserSubscription(
  userId: string
): Promise<UserSubscription> {
  const fallback: UserSubscription = {
    tier: "free",
    status: "active",
    currentPeriodEnd: null,
    hasStripeCustomer: false,
    cancelAtPeriodEnd: false,
  };
  if (!supabaseAdmin) return fallback;
  try {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "tier, status, current_period_end, provider_customer_id, cancel_at_period_end"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return fallback;

    const active = data.status === "active";
    const tier =
      active && (PLAN_TIERS as readonly string[]).includes(data.tier)
        ? (data.tier as PlanTier)
        : "free";

    return {
      tier,
      status: data.status ?? "active",
      currentPeriodEnd: data.current_period_end ?? null,
      hasStripeCustomer: Boolean(data.provider_customer_id),
      cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    };
  } catch (err) {
    console.error("[plans] getUserSubscription failed:", err);
    return fallback;
  }
}
