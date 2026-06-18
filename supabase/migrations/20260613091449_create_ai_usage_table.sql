-- Log zużycia AI per użytkownik: każde wywołanie funkcji AI (transkrypcja, terapeuta,
-- agent API) zapisuje wiersz. Pozwala właścicielowi widzieć, kto zużywa kredyty xAI/Groq.
-- Insert wykonuje serwer kluczem sekretnym (omija RLS); RLS chroni odczyt do własnych wierszy.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  endpoint text not null check (endpoint in ('transcribe', 'therapist', 'api_agent')),
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_id_created_at_idx
  on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_created_at_idx
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

-- Użytkownik widzi tylko własne zużycie (panel właściciela czyta wszystko serwerowo,
-- kluczem sekretnym, z omięciem RLS).
create policy "ai_usage_select_own"
  on public.ai_usage for select
  using (auth.uid() = user_id);
