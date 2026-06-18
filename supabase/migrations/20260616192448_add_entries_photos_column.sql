alter table public.entries add column if not exists photos jsonb not null default '[]'::jsonb;
