-- Billing day-of-month for the mortgage (one for the whole mortgage) and per loan.
-- The monthly payment is charged on this day; null falls back to the start date's day.
-- Nullable + additive, so existing rows keep working (fallback = start-date day).
alter table mortgages add column if not exists payment_day int
  check (payment_day is null or (payment_day >= 1 and payment_day <= 31));

alter table loans add column if not exists payment_day int
  check (payment_day is null or (payment_day >= 1 and payment_day <= 31));
