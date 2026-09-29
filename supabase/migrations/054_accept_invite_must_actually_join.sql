-- 054 — הצטרפות שלא צירפה אף אחד לא תיחשב כהצטרפות
--
-- What happened (live database, 29.09): the one invitation ever sent was marked accepted
-- seventeen seconds after it was created, and nobody was added to the apartment. The
-- invitation was then gone from both the sender's screen ("ממתין/ה" disappeared) and the
-- invitee's (an accepted invitation is not offered again) — so the feature reported
-- success twice over while having done nothing at all. That is the worst failure mode
-- available to it: a silent one, on the only path that matters.
--
-- The cause is one clause. `insert ... on conflict do nothing`, written with no conflict
-- target, swallows ANY unique violation — and then the function carried on and stamped
-- `accepted_at` as though the insert had happened. Both statements are in one transaction,
-- so the insert did not fail; it was skipped, and nothing checked.
--
-- Two changes, both narrow:
--
--  1. The conflict target is explicit — (household_id, user_id), the only collision that
--     is genuinely harmless (accepting twice). Anything else must surface.
--  2. The function now asserts the membership exists before it marks the invitation used.
--     An accept that did not result in membership raises `join_failed` and rolls the
--     whole thing back, so the invitation stays pending and can be tried again. An
--     invitation is not spent until it has actually let someone in.
--
-- Accepting twice stays a success: the row is already there, the membership is real, and
-- telling someone "ההזמנה כבר נוצלה" when they are in fact a member would be a lie about
-- a state they can see for themselves.
--
-- No policy, table or column changes. Re-applying is a no-op (create or replace).

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

  -- Already a member? Then this has already worked, whatever the invitation says. Return
  -- the apartment rather than an error about a state the caller can see is fine.
  if exists (
    select 1 from household_members
    where household_id = inv.household_id and user_id = auth.uid()
  ) then
    update household_invites set accepted_at = coalesce(accepted_at, now()) where id = inv.id;
    return inv.household_id;
  end if;

  if inv.accepted_at is not null then
    raise exception 'invite_already_used';
  end if;

  -- Explicit target: accepting twice is harmless and is the only conflict worth ignoring.
  -- A bare `on conflict do nothing` here hid a real failure for a day.
  insert into household_members (household_id, user_id, role)
  values (inv.household_id, auth.uid(), coalesce(inv.role, 'member'))
  on conflict (household_id, user_id) do nothing;

  -- The whole point of the function. Marking an invitation used without the membership
  -- to show for it spends the invitation and leaves the person outside, with nothing on
  -- either screen to say so.
  if not exists (
    select 1 from household_members
    where household_id = inv.household_id and user_id = auth.uid()
  ) then
    raise exception 'join_failed'
      using hint = 'ההצטרפות לא הושלמה — ההזמנה נשארת פתוחה';
  end if;

  update household_invites set accepted_at = now() where id = inv.id;
  return inv.household_id;
end;
$$;

-- ── Repairing what the old clause left behind ────────────────────────────────
-- The live database holds an invitation stamped accepted with no membership to show for
-- it. In that state the invitation is spent from both sides at once: the sender's screen
-- no longer lists it as pending, the invitee is never offered it again, and `upsert_invite`
-- is the only way back — which nobody knows to reach for, because nothing says anything is
-- wrong. It is the exact position the owner described: "לעומר כבר יש דירה והוא לא רואה".
--
-- So: an invitation that produced no membership is reopened. Not granted — reopened. It
-- returns to pending and is offered again, which is what the person who sent it asked for
-- and never got. Nobody gains access from this statement; the only way in is still
-- accept_invite, and it now refuses to lie about having worked.
--
-- This also reopens an invitation for someone who joined and then deliberately left. That
-- is the better of the two behaviours available: today, leaving makes a person permanently
-- un-re-invitable (the invitation row survives the membership, `accepted_at` set), and
-- being offered a card you can decline is a smaller harm than a door that cannot be
-- reopened. Declining is one tap, and the sender can cancel the invitation outright.
--
-- Idempotent: once the memberships exist, this matches nothing.
update household_invites i
set accepted_at = null
where i.accepted_at is not null
  and not exists (
    select 1
    from auth.users u
    join household_members m
      on m.household_id = i.household_id and m.user_id = u.id
    where lower(u.email) = lower(i.email)
  );
