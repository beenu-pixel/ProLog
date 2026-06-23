-- Plany płatne (monetyzacja): plan użytkownika trzymany w public.subscriptions.
-- Jeden wiersz = jeden użytkownik. Brak wiersza lub status != 'active' znaczy plan
-- darmowy (free) — patrz getUserPlan w src/lib/plans.ts.
--
-- Źródłem prawdy o planie jest webhook Stripe (Faza 1), który upsertuje ten wiersz
-- kluczem sekretnym (omija RLS). UI NIGDY nie ustawia planu sama — czyta tylko swój
-- wiersz (RLS poniżej). Tier i status mają checki, by webhook nie wstawił śmieci.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro', 'max')),
  status text not null default 'active'
    check (status in ('active', 'canceled', 'past_due', 'incomplete')),
  -- Identyfikatory u dostawcy płatności (Stripe). NULL dopóki nie było zakupu.
  provider text check (provider in ('stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  -- Koniec bieżącego okresu rozliczeniowego (z subskrypcji Stripe) — pomaga
  -- rozstrzygać webhooki przychodzące nie po kolei.
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_provider_customer_idx
  on public.subscriptions (provider_customer_id);

alter table public.subscriptions enable row level security;

-- Użytkownik widzi WYŁĄCZNIE swój plan. Zapisu z poziomu anon/authenticated nie ma —
-- plan ustawia tylko serwer kluczem sekretnym (webhook Stripe), który omija RLS.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);
