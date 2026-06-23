-- Raporty (Faza 2 monetyzacji) to nowa funkcja AI rozliczana w ai_usage. Tabela
-- miała CHECK ograniczający endpoint do transcribe/therapist/api_agent — dodajemy
-- 'reports', żeby logowanie zużycia raportów nie łamało ograniczenia.
alter table public.ai_usage drop constraint if exists ai_usage_endpoint_check;
alter table public.ai_usage add constraint ai_usage_endpoint_check
  check (endpoint in ('transcribe', 'therapist', 'api_agent', 'reports'));
