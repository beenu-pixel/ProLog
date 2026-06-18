-- Włącz pgvector (rozszerzenie `vector`) w schemacie extensions.
create extension if not exists vector with schema extensions;

-- Jeden wektor semantyczny na wpis (OpenAI text-embedding-3-small → 1536 wymiarów).
alter table public.entries
  add column if not exists embedding extensions.vector(1536);

-- Indeks HNSW (cosinus) pod przyszłe wyszukiwanie podobieństwa. Tani przy małym
-- wolumenie; tworzony z góry, żeby kolejny etap (hybrid search) miał gotowy indeks.
create index if not exists entries_embedding_hnsw
  on public.entries
  using hnsw (embedding extensions.vector_cosine_ops);
