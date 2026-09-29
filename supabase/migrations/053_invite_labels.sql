-- An invitation that says whose apartment it is, and can be sent again.
--
-- Two things went wrong the first time a real person was invited (owner, 29.09).
--
-- ── 1. The invitation could not name itself ─────────────────────────────────
-- The card read "הוזמנת לדירה" with nothing identifying, because the person invited is
-- not a member yet and therefore cannot read the inviting household's `owners` row or
-- its property — which is correct, and must stay correct. Widening those policies so an
-- invitee can look up an apartment they have not joined would trade a real privacy
-- boundary for a line of text.
--
-- So the text travels WITH the invitation, written by the inviter, who can read both.
-- Display only: nothing is decided from these columns.
alter table household_invites
  add column if not exists household_label text,
  add column if not exists invited_by_label text;

-- ── 2. An invitation could not be sent twice ────────────────────────────────
-- `unique (household_id, email)` is right — one open invitation per address — but the
-- client treated the collision as an error ("כבר נשלחה הזמנה"), so a person who never
-- received the first one could not be sent another, and someone who left the household
-- could never be re-invited at all.
--
-- Re-sending is an UPDATE of the existing row, not a second row: same invitation, newly
-- offered. A SECURITY DEFINER function so that re-sending cannot be used to discover
-- whether an address was invited by somebody else — it refuses anything outside the
-- caller's own households, and the membership check is the same one the policies use.
create or replace function public.upsert_invite(
  p_household uuid,
  p_email text,
  p_role text default 'member',
  p_household_label text default null,
  p_invited_by_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  addr text := lower(trim(p_email));
  inv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  -- Only a full member of THIS household may invite. A viewer who could invite a full
  -- member would be promoting themselves by proxy (see 052).
  if p_household not in (select public.auth_households_rw()) then
    raise exception 'not_allowed';
  end if;
  if addr = '' or addr !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'bad_email';
  end if;
  if coalesce(p_role, 'member') not in ('member', 'viewer') then
    raise exception 'bad_role';
  end if;
  -- The cap counts places already taken: members plus invitations still open. Checked
  -- here as well as by the membership trigger, because an invitation is a place spoken
  -- for and the trigger only fires when someone actually joins.
  if (select count(*) from household_members where household_id = p_household)
   + (select count(*) from household_invites
       where household_id = p_household and accepted_at is null
         and lower(email) <> addr) >= 3 then
    raise exception 'household_full';
  end if;
  if exists (select 1 from household_members hm
              join owners o on o.id = hm.user_id
             where hm.household_id = p_household and lower(o.email) = addr) then
    raise exception 'already_member';
  end if;

  insert into household_invites
    (household_id, email, role, invited_by, household_label, invited_by_label)
  values
    (p_household, addr, coalesce(p_role, 'member'), auth.uid(), p_household_label, p_invited_by_label)
  on conflict (household_id, email) do update
    set role             = excluded.role,
        invited_by       = excluded.invited_by,
        household_label  = excluded.household_label,
        invited_by_label = excluded.invited_by_label,
        created_at       = now(),
        -- Re-offering an invitation that was accepted and then left behind: it becomes
        -- open again rather than being stuck in the accepted state forever.
        accepted_at      = null
  returning id into inv_id;

  return inv_id;
end;
$$;

revoke all on function public.upsert_invite(uuid, text, text, text, text) from public;
grant execute on function public.upsert_invite(uuid, text, text, text, text) to authenticated;
