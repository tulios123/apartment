-- צופה בלבד — the second kind of membership. (Owner, 29.09.)
--
-- 051 gave every member the same rights, because "equal" was the decision at the time.
-- This adds the other option and makes it a CHOICE made when inviting: שותף מלא, who can
-- do everything the person who invited them can, or צופה בלבד, who can read the apartment
-- and change nothing.
--
-- ── Where it is enforced ─────────────────────────────────────────────────────
-- Here, in the policies, and nowhere else that counts. The client hides what a viewer
-- cannot do so they are not led into a wall, but hiding a button is a courtesy and not a
-- permission: anyone can call the API directly. So each household table's single
-- `for all` policy is split in two — SELECT for any member, and INSERT/UPDATE/DELETE for
-- members who are not viewers.
--
-- Splitting rather than adding a condition to the existing `for all` is deliberate:
-- Postgres evaluates a `for all` policy's USING clause for reads AND for the row-matching
-- half of updates and deletes, so a single policy cannot say "read yes, write no" without
-- becoming hard to reason about. Four narrow policies each say one thing.
--
-- `role` already exists on household_members (051 created it with a default of 'member'
-- so that this question would have somewhere to live when it was asked). Everyone
-- currently in a household is a 'member', so nobody's access changes when this runs.

-- ── Who may write ────────────────────────────────────────────────────────────
-- Same SECURITY DEFINER reasoning as auth_households(): the policies below ask this
-- question, answering it reads household_members, and routing that read through
-- household_members' own RLS would recurse.
create or replace function public.auth_households_rw()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from household_members
   where user_id = auth.uid() and coalesce(role, 'member') <> 'viewer'
$$;

revoke all on function public.auth_households_rw() from public;
grant execute on function public.auth_households_rw() to authenticated;

-- ── The role travels with the invitation ─────────────────────────────────────
-- Chosen when inviting, not negotiated afterwards, so the person accepting knows what
-- they are accepting and the app never has to guess a default.
alter table household_invites
  add column if not exists role text not null default 'member';

-- ── Re-split every household table ───────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'properties', 'contracts', 'recurring_items', 'transactions', 'tasks', 'documents',
    'investment_costs', 'mortgages', 'mortgage_tracks', 'insurance_policies', 'loans',
    'purchase_plans'
  ] loop
    execute format('drop policy if exists "owner_scoped" on %I', t);
    execute format('drop policy if exists "household_read" on %I', t);
    execute format('drop policy if exists "household_insert" on %I', t);
    execute format('drop policy if exists "household_update" on %I', t);
    execute format('drop policy if exists "household_delete" on %I', t);

    execute format($f$
      create policy "household_read" on %I
        for select to authenticated
        using (owner_id in (select public.auth_households()))
    $f$, t);
    execute format($f$
      create policy "household_insert" on %I
        for insert to authenticated
        with check (owner_id in (select public.auth_households_rw()))
    $f$, t);
    execute format($f$
      create policy "household_update" on %I
        for update to authenticated
        using (owner_id in (select public.auth_households_rw()))
        with check (owner_id in (select public.auth_households_rw()))
    $f$, t);
    execute format($f$
      create policy "household_delete" on %I
        for delete to authenticated
        using (owner_id in (select public.auth_households_rw()))
    $f$, t);
  end loop;
end $$;

-- contract_utilities has no owner_id; gated through its contract, same split.
drop policy if exists "owner_scoped" on contract_utilities;
drop policy if exists "household_read" on contract_utilities;
drop policy if exists "household_insert" on contract_utilities;
drop policy if exists "household_update" on contract_utilities;
drop policy if exists "household_delete" on contract_utilities;

create policy "household_read" on contract_utilities
  for select to authenticated
  using (contract_id in (select id from contracts where owner_id in (select public.auth_households())));
create policy "household_insert" on contract_utilities
  for insert to authenticated
  with check (contract_id in (select id from contracts where owner_id in (select public.auth_households_rw())));
create policy "household_update" on contract_utilities
  for update to authenticated
  using (contract_id in (select id from contracts where owner_id in (select public.auth_households_rw())))
  with check (contract_id in (select id from contracts where owner_id in (select public.auth_households_rw())));
create policy "household_delete" on contract_utilities
  for delete to authenticated
  using (contract_id in (select id from contracts where owner_id in (select public.auth_households_rw())));

-- The household row. A viewer may read the apartment's name; only a full member may
-- rename it. `id = auth.uid()` stays on both halves so a brand-new account can still
-- create its own row on first sign-in, before any membership exists.
drop policy if exists "owner_scoped" on owners;
drop policy if exists "household_read" on owners;
drop policy if exists "household_write" on owners;

create policy "household_read" on owners
  for select to authenticated
  using (id = auth.uid() or id in (select public.auth_households()));
create policy "household_write" on owners
  for all to authenticated
  using (id = auth.uid() or id in (select public.auth_households_rw()))
  with check (id = auth.uid() or id in (select public.auth_households_rw()));

-- ── Inviting is a member's act, not a viewer's ───────────────────────────────
-- A viewer who could invite could invite a full member, which is the same as promoting
-- themselves by proxy.
drop policy if exists "invites_by_members" on household_invites;
-- …and the two this file creates, so applying it twice is a no-op rather than an error.
-- Every other block here already dropped the names it goes on to create; this one did not,
-- which made the whole file non-re-runnable and would have failed the owner's next
-- `supabase db push` outright (29.09).
drop policy if exists "invites_read_by_members" on household_invites;
drop policy if exists "invites_managed_by_members" on household_invites;
create policy "invites_read_by_members" on household_invites
  for select to authenticated
  using (household_id in (select public.auth_households()));
create policy "invites_managed_by_members" on household_invites
  for all to authenticated
  using (household_id in (select public.auth_households_rw()))
  with check (household_id in (select public.auth_households_rw()));

-- ── Accepting carries the role it was offered with ───────────────────────────
create or replace function public.accept_invite(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv household_invites;
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or my_email = '' then
    raise exception 'not_authenticated';
  end if;

  select * into inv from household_invites where id = invite_id;
  if not found or lower(inv.email) <> my_email then
    -- Same answer either way: whether an invitation exists is not something an uninvited
    -- caller gets to learn.
    raise exception 'invite_not_found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite_already_used';
  end if;

  insert into household_members (household_id, user_id, role)
  values (inv.household_id, auth.uid(), coalesce(inv.role, 'member'))
  on conflict do nothing;

  update household_invites set accepted_at = now() where id = inv.id;
  return inv.household_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ── Documents in storage ─────────────────────────────────────────────────────
-- Reading widens to anyone sharing a household, as in 051. Writing and deleting are for
-- full members only — and uploading still goes to your OWN folder, so a file stays
-- attributable to whoever added it.
drop policy if exists "auth_read" on storage.objects;
create policy "auth_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select hm.user_id::text from household_members hm
      where hm.household_id in (select public.auth_households())
    )
  );

drop policy if exists "auth_delete" on storage.objects;
create policy "auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select hm.user_id::text from household_members hm
      where hm.household_id in (select public.auth_households_rw())
    )
  );

drop policy if exists "auth_upload" on storage.objects;
create policy "auth_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    -- …and only if you may write to at least one apartment. A viewer has no business
    -- putting files into shared storage.
    and exists (select 1 from public.auth_households_rw())
  );
