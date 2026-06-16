-- Wyszukiwanie hybrydowe: full-text (FTS) + funkcja RRF łącząca FTS z wektorem.
-- Embeddingi (kolumna entries.embedding vector(1536) + indeks HNSW) już istnieją.
-- Zastosowane na projekcie aqdtcggmownyvsnxnjao przez apply_migration.

-- 1) unaccent — ignorowanie polskich znaków diakrytycznych (spójnie z deburr w kliencie).
create extension if not exists unaccent with schema extensions;

-- 2) Immutable wrapper: unaccent() samo w sobie nie jest IMMUTABLE, więc nie może
--    wejść do kolumny generowanej ani indeksu. Opakowujemy je w funkcję IMMUTABLE.
create or replace function public.immutable_unaccent(text)
  returns text
  language sql
  immutable
  parallel safe
  strict
  as $func$
    select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
  $func$;

-- 3) Kolumna FTS (tsvector). Treść to HTML — zdejmujemy tagi. Konfiguracja 'simple',
--    bo Postgres nie ma słownika 'polish', a diakrytykę usuwa immutable_unaccent.
alter table public.entries
  add column if not exists fts tsvector
  generated always as (
    to_tsvector(
      'simple',
      public.immutable_unaccent(
        coalesce(title, '') || ' ' ||
        regexp_replace(coalesce(content, ''), '<[^>]*>', ' ', 'g')
      )
    )
  ) stored;

create index if not exists entries_fts_idx on public.entries using gin (fts);

-- 4) Funkcja hybrid_search: top-N z FTS + top-N z wektora, scalone fuzją RRF.
--    Filtruje po p_user_id — wołana kluczem sekretnym (pomija RLS), spójnie z services/entries.ts.
create or replace function public.hybrid_search(
  p_user_id uuid,
  query_text text,
  query_embedding vector(1536),
  match_count int default 30,
  full_text_weight float default 1,
  semantic_weight float default 1,
  rrf_k int default 50
)
returns setof public.entries
language sql
stable
as $func$
  with fts as (
    select
      id,
      row_number() over (
        order by ts_rank_cd(
          fts,
          websearch_to_tsquery('simple', public.immutable_unaccent(query_text))
        ) desc
      ) as rank_ix
    from public.entries
    where user_id = p_user_id
      and fts @@ websearch_to_tsquery('simple', public.immutable_unaccent(query_text))
    order by rank_ix
    limit least(match_count, 30) * 2
  ),
  semantic as (
    select
      id,
      row_number() over (order by embedding <=> query_embedding) as rank_ix
    from public.entries
    where user_id = p_user_id
      and embedding is not null
    order by rank_ix
    limit least(match_count, 30) * 2
  )
  select e.*
  from fts
  full outer join semantic on fts.id = semantic.id
  join public.entries e on e.id = coalesce(fts.id, semantic.id)
  order by
    coalesce(1.0 / (rrf_k + fts.rank_ix), 0.0) * full_text_weight +
    coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight desc
  limit least(match_count, 30);
$func$;
