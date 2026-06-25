-- Cadence tracking for lease-lifecycle push reminders.
-- The daily-reminders edge function runs daily, but these reminders must NOT fire
-- daily: the renewal reminder repeats ~monthly while a contract is in its 2-month
-- window, and the "no active lease" reminder repeats ~fortnightly. One row per
-- (owner, kind) records when each was last sent so the daily run can throttle it.
-- Service-role only (the edge function reads/writes it) — no client policy.
create table if not exists reminder_log (
  owner_id  uuid not null references owners(id) on delete cascade,
  kind      text not null,            -- 'renewal' | 'no-lease'
  last_sent date not null,
  primary key (owner_id, kind)
);

alter table reminder_log enable row level security;
-- intentionally no policy: only the service role (edge function) touches this table.
