-- keep_alive: „bicie serca" dla darmowego planu Supabase.
--
-- Darmowy projekt usypia się po ~7 dniach bez aktywności. Codzienny ODCZYT
-- (count na entries, Vercel Cron od 17.09.2026) nie wystarczył — 01.10.2026
-- przyszło ostrzeżenie o uśpieniu. /api/keep-alive robi więc prawdziwy ZAPIS:
-- przy każdym wywołaniu wstawia tu wiersz i usuwa wiersze starsze niż 30 dni.
--
-- Dostęp wyłącznie kluczem sekretnym (service_role omija RLS); dla anon/
-- authenticated jawna polityka deny-all, jak w rate_limit_hits.

create table if not exists public.keep_alive (
  id bigint generated always as identity primary key,
  pinged_at timestamptz not null default now()
);

alter table public.keep_alive enable row level security;

drop policy if exists "keep_alive deny anon" on public.keep_alive;
create policy "keep_alive deny anon"
  on public.keep_alive
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
