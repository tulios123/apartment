-- שיתוף דירה — up to three equal people on the same apartment, and a person on more
-- than one apartment, switching between them. (Owner, 25.09; the feature Omer asked for.)
--
-- ── The idea, in one line ────────────────────────────────────────────────────
-- `owner_id` stops meaning "the logged-in user" and starts meaning "the household".
-- Nothing is renamed and no row moves: every existing `owners` row simply becomes a
-- household whose id happens to equal its creator's auth id, and a membership row is
-- backfilled to say so. That is what makes this change additive against a live database
-- with real family data in it.
--
-- ── Why not a new `properties.household_id` column ───────────────────────────
-- Because `owner_id` is already on all 14 household-scoped tables and already indexed,
-- and reinterpreting it costs one membership lookup in each policy. Adding a second
-- scoping column would mean backfilling 14 tables and keeping two notions of ownership
-- in step forever — far more dangerous, for the same result.
--
-- ── What is deliberately NOT shared ──────────────────────────────────────────
-- push_subscriptions (a device belongs to a person, not to an apartment) and
-- feedback / feedback_messages (my report is mine, and the admin policies there are
-- about a different question entirely). Those keep `owner_id = auth.uid()` and are
-- untouched below. Getting this distinction wrong is how a shared apartment would start
-- sending Moran's phone Omer's notifications, or showing her his messages to the owner.

-- ── Membership ───────────────────────────────────────────────────────────────

create table if not exists household_members (
  household_id uuid not null references owners(id) on delete cascade,
  -- auth.users id. No FK: auth is a separate schema and the owners row already carries
  -- the account, so an FK here would only add a cross-schema dependency.
  user_id uuid not null,
  -- Everyone is equal (owner's decision, 25.09) — the column exists so that "who may
  -- remove whom" has somewhere to live the day it is asked, not to gate anything today.
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on household_members (user_id);

-- Every apartment that exists today becomes a household of one: its creator.
insert into household_members (household_id, user_id)
select id, id from owners
on conflict do nothing;

-- ── Three, and no more ───────────────────────────────────────────────────────
-- Enforced here rather than in the client, because the client is not the only way in and
-- a cap that can be walked around is not a cap. The number is the owner's ("כרגע עד
-- שלושה") and lives in one place.

create or replace function public.enforce_household_size()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from household_members where household_id = new.household_id) >= 3 then
    raise exception 'household_full'
      using hint = 'דירה יכולה לכלול עד שלושה אנשים';
  end if;
  return new;
end;
$$;

drop trigger if exists household_members_cap on household_members;
create trigger household_members_cap
  before insert on household_members
  for each row execute function public.enforce_household_size();

-- ── The households I belong to ───────────────────────────────────────────────
-- SECURITY DEFINER on purpose, and it is the load-bearing detail of this whole file:
-- every policy below asks "is this row's owner_id one of my households?", and answering
-- that means reading household_members. If that read went through household_members' own
-- RLS — which asks the same question — the policy would recurse forever. A definer
-- function reads the table once, outside RLS, and returns only rows for the CALLER's
-- auth.uid(), so it cannot be used to see anyone else's membership.
create or replace function public.auth_households()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid()
$$;

revoke all on function public.auth_households() from public;
grant execute on function public.auth_households() to authenticated;

alter table household_members enable row level security;

drop policy if exists "members_read" on household_members;
create policy "members_read" on household_members
  for select to authenticated
  using (household_id in (select public.auth_households()));

-- Leaving is allowed; removing someone else is not, until there is a reason for it to be.
drop policy if exists "members_leave" on household_members;
create policy "members_leave" on household_members
  for delete to authenticated
  using (user_id = auth.uid());

-- Joining happens through accept_invite() below, never by a direct insert: an insert
-- policy permissive enough to let someone add themselves to a household is exactly the
-- hole this feature must not open.

-- ── Invitations ──────────────────────────────────────────────────────────────

create table if not exists household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references owners(id) on delete cascade,
  -- Stored lower-cased; matched against the signed-in account's own email claim.
  email text not null,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (household_id, email)
);
create index if not exists household_invites_email_idx on household_invites (lower(email));

alter table household_invites enable row level security;

-- Members manage their own household's invitations…
drop policy if exists "invites_by_members" on household_invites;
create policy "invites_by_members" on household_invites
  for all to authenticated
  using (household_id in (select public.auth_households()))
  with check (household_id in (select public.auth_households()));

-- …and the person invited can see the invitation addressed to them, so the app can offer
-- it rather than requiring them to be told a code.
drop policy if exists "invites_to_me" on household_invites;
create policy "invites_to_me" on household_invites
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Accepting is a function, not a policy. It is the only way to gain membership, it checks
-- the invitation belongs to the caller's own email, and the member cap trigger still
-- applies inside it.
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
    -- Same message either way: whether an invitation exists is not something an
    -- uninvited caller gets to learn.
    raise exception 'invite_not_found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite_already_used';
  end if;

  insert into household_members (household_id, user_id)
  values (inv.household_id, auth.uid())
  on conflict do nothing;

  update household_invites set accepted_at = now() where id = inv.id;
  return inv.household_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ── Re-scope every household table ───────────────────────────────────────────
-- Mechanical and identical: `owner_id = auth.uid()` becomes `owner_id in (my households)`.
-- For a person in exactly one household — which is everyone until someone is invited —
-- the set contains only their own id, so this evaluates to precisely what it did before.

do $$
declare t text;
begin
  foreach t in array array[
    'properties', 'contracts', 'recurring_items', 'transactions', 'tasks', 'documents',
    'investment_costs', 'mortgages', 'mortgage_tracks', 'insurance_policies', 'loans',
    'purchase_plans'
  ] loop
    execute format('drop policy if exists "owner_scoped" on %I', t);
    execute format($f$
      create policy "owner_scoped" on %I
        for all to authenticated
        using (owner_id in (select public.auth_households()))
        with check (owner_id in (select public.auth_households()))
    $f$, t);
  end loop;
end $$;

-- contract_utilities has no owner_id and is gated through its contract.
drop policy if exists "owner_scoped" on contract_utilities;
create policy "owner_scoped" on contract_utilities
  for all to authenticated
  using (contract_id in (select id from contracts where owner_id in (select public.auth_households())))
  with check (contract_id in (select id from contracts where owner_id in (select public.auth_households())));

-- The household row itself. `id = auth.uid()` stays in the policy deliberately: a brand-new
-- account upserts its own owners row on first sign-in, before any membership exists, and
-- without this clause that first write would be denied and nobody could ever sign up.
drop policy if exists "owner_scoped" on owners;
create policy "owner_scoped" on owners
  for all to authenticated
  using (id = auth.uid() or id in (select public.auth_households()))
  with check (id = auth.uid() or id in (select public.auth_households()));

-- …and creating a household makes you its first member, so the chicken-and-egg above
-- closes itself instead of relying on the client to remember.
create or replace function public.owner_self_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into household_members (household_id, user_id)
  values (new.id, new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists owners_self_membership on owners;
create trigger owners_self_membership
  after insert on owners
  for each row execute function public.owner_self_membership();

-- ── Documents in storage ─────────────────────────────────────────────────────
-- Files live at {uploader_uid}/docs/{id}.{ext}. Rather than move anyone's files, reading
-- widens to any folder belonging to someone who shares a household with me. Uploading
-- stays in my OWN folder, so a file remains attributable to the person who added it.

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
      where hm.household_id in (select public.auth_households())
    )
  );

-- auth_upload is unchanged on purpose: you write into your own folder.
