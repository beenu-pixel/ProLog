-- Panel „Plan i płatności" ma rozróżniać subskrypcję, która się ODNOWI, od takiej,
-- która została ANULOWANA na koniec okresu (Stripe: cancel_at_period_end). Wtedy
-- pokazujemy „Anulowana — dostęp do <data>" zamiast „Odnawia się <data>".
-- Flagę ustawia webhook ze zdarzenia customer.subscription.updated.
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
