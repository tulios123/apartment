-- Per-owner usage counter for the paid extract-* edge functions.
-- Each extract-* call is a billed Anthropic request. A signed-in family member
-- could (accidentally or otherwise) run up the bill with a tight upload loop.
-- The functions record one row per call here and reject once an owner exceeds a
-- rolling-hour budget (see supabase/functions/_shared/rateLimit.ts).
-- Service-role only — the edge function counts + inserts + prunes; the client
-- never touches this table directly.
create table if not exists extract_usage (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references owners(id) on delete cascade,
  fn        text not null,            -- 'extract-mortgage' | 'extract-loan' | 'extract-rental' | 'extract-contract'
  called_at timestamptz not null default now()
);

-- Count "this owner's calls in the last hour" is the hot query — index it.
create index if not exists extract_usage_owner_time_idx
  on extract_usage (owner_id, called_at desc);

alter table extract_usage enable row level security;
-- intentionally no policy: only the service role (edge function) touches this table.
-- Deny-by-default RLS blocks the anon/authenticated roles; service role bypasses RLS.
