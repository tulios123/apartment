-- Web-push delivery for proactive reminders (Stage B).
-- One row per device/browser endpoint; an owner can have several.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index on push_subscriptions (owner_id);
alter table push_subscriptions enable row level security;
create policy "owner_scoped" on push_subscriptions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Once-per-day send guard. Only the daily edge function (service role) touches
-- this — no client policy, so RLS denies all authenticated access by default.
create table push_log (
  owner_id uuid not null references owners(id) on delete cascade,
  sent_on date not null,
  primary key (owner_id, sent_on)
);
alter table push_log enable row level security;
