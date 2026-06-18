-- Rozmowy z cyfrowym terapeutą: jedna rozmowa per (user, therapist),
-- wiadomości w osobnej tabeli. RLS per user_id, jak przy public.entries.

create table if not exists public.therapist_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  therapist_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, therapist_id)
);

create table if not exists public.therapist_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.therapist_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists therapist_messages_conversation_idx
  on public.therapist_messages (conversation_id, created_at);

alter table public.therapist_conversations enable row level security;
alter table public.therapist_messages enable row level security;

create policy "own therapist conversations"
  on public.therapist_conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own therapist messages"
  on public.therapist_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
