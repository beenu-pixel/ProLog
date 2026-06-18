create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text,
  token_hash text not null unique,
  token_prefix text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index api_tokens_user_id_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;

create policy "api_tokens_select_own" on public.api_tokens
  for select using (auth.uid() = user_id);

create policy "api_tokens_insert_own" on public.api_tokens
  for insert with check (auth.uid() = user_id);

create policy "api_tokens_delete_own" on public.api_tokens
  for delete using (auth.uid() = user_id);
