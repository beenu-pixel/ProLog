-- rate_limit_hits: jawne polityki "deny-all" dla zwykłych ról.
--
-- Tabela ma RLS włączone celowo BEZ polityk, by zwykłe role (anon/authenticated)
-- nie miały dostępu — zapis/odczyt liczników idzie wyłącznie kluczem sekretnym
-- (service_role omija RLS). Supabase database-linter zgłasza jednak ostrzeżenie
-- "RLS Enabled No Policy" (lint 0008). Dodajemy więc jawne polityki odmawiające
-- dostępu anon/authenticated: zachowanie pozostaje identyczne (service_role nadal
-- omija RLS), a intencja jest udokumentowana i linter przestaje ostrzegać.

alter table public.rate_limit_hits enable row level security;

drop policy if exists "rate_limit_hits deny anon" on public.rate_limit_hits;
create policy "rate_limit_hits deny anon"
  on public.rate_limit_hits
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
