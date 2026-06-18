-- Uszczelnienie bezpieczeństwa: (1) tabela liczników rate-limit, (2) ustawienie
-- stałego search_path w funkcjach (usuwa advisory function_search_path_mutable).
-- Zastosowane na projekcie aqdtcggmownyvsnxnjao przez apply_migration.

-- 1) Liczniki rate-limit ("stemple"): jeden wiersz = jedno żądanie funkcji AI.
--    Zliczane w oknie minutowym (anty-pętla) i dziennym (sufit kosztowy). Zapis/odczyt
--    wyłącznie kluczem sekretnym — RLS włączone BEZ polityk (zwykłe role nie mają dostępu).
create table if not exists public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_lookup_idx
  on public.rate_limit_hits (user_id, bucket, created_at desc);

alter table public.rate_limit_hits enable row level security;

-- 2) Stały search_path w funkcjach. ALTER (zamiast CREATE OR REPLACE) zmienia tylko
--    konfigurację — nie dotyka ciała, generowanej kolumny `entries.fts` ani indeksów.
--    `extensions` na liście, bo tam żyją unaccent i operator wektorowy <=> (pgvector).
alter function public.immutable_unaccent(text)
  set search_path = pg_catalog, extensions;

alter function public.hybrid_search(
  uuid, text, extensions.vector, int, float, float, int
) set search_path = pg_catalog, extensions, public;
