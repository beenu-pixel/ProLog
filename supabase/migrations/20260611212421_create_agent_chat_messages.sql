create table public.agent_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index agent_chat_messages_user_day_idx
  on public.agent_chat_messages (user_id, day, created_at);

alter table public.agent_chat_messages enable row level security;

create policy "agent_chat_messages_select_own" on public.agent_chat_messages
  for select using (auth.uid() = user_id);

create policy "agent_chat_messages_insert_own" on public.agent_chat_messages
  for insert with check (auth.uid() = user_id);

create policy "agent_chat_messages_delete_own" on public.agent_chat_messages
  for delete using (auth.uid() = user_id);
