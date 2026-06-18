create table public.entries (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title        text not null,
  content      text not null default '',
  mood         smallint check (mood between 1 and 5),
  sleep        smallint check (sleep between 1 and 5),
  energy       smallint check (energy between 1 and 5),
  productivity smallint check (productivity between 1 and 5),
  stress       smallint check (stress between 1 and 5),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create index entries_user_created_idx on public.entries (user_id, created_at desc);

alter table public.entries enable row level security;

create policy "own entries - select" on public.entries
  for select using (auth.uid() = user_id);
create policy "own entries - insert" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "own entries - update" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entries - delete" on public.entries
  for delete using (auth.uid() = user_id);
