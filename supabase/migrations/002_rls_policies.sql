-- Phase 1: single user, no auth.
-- Allow full access via anon key. Will be replaced with user-scoped
-- policies when auth is added in the family-sharing phase.

alter table owners enable row level security;
alter table properties enable row level security;
alter table contracts enable row level security;
alter table contract_utilities enable row level security;
alter table recurring_items enable row level security;
alter table transactions enable row level security;
alter table tasks enable row level security;
alter table documents enable row level security;

-- Permissive policies for anon role (all operations)
create policy "anon_all" on owners for all to anon using (true) with check (true);
create policy "anon_all" on properties for all to anon using (true) with check (true);
create policy "anon_all" on contracts for all to anon using (true) with check (true);
create policy "anon_all" on contract_utilities for all to anon using (true) with check (true);
create policy "anon_all" on recurring_items for all to anon using (true) with check (true);
create policy "anon_all" on transactions for all to anon using (true) with check (true);
create policy "anon_all" on tasks for all to anon using (true) with check (true);
create policy "anon_all" on documents for all to anon using (true) with check (true);
