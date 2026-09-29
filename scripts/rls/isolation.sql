-- Does the shared-apartment change leak anything?
--
-- This is the test that had to exist before migration 051 went anywhere near production.
-- The risk of re-scoping twenty RLS policies is not that the feature fails to work — that
-- is obvious the moment you look. It is that it works AND quietly widens: one family
-- seeing another's money, or a member who left still reading the documents.
--
-- It runs against a real Postgres with every migration applied (scripts/rls/verify.sh),
-- because RLS cannot be tested anywhere else: the e2e harness stubs the REST layer
-- entirely and never evaluates a policy at all.
--
-- Every check raises on failure, so the script's exit code is the verdict.

\set ON_ERROR_STOP on
set role postgres;

-- ── Cast ─────────────────────────────────────────────────────────────────────
--  omer + moran share Omer's apartment.
--  omer also has a second apartment of his own (the "switch between them" case).
--  dana is a stranger with her own apartment and no connection to either.

create temporary table ids (who text primary key, id uuid);
insert into ids values
  ('omer',      '11111111-1111-1111-1111-111111111111'),
  ('moran',     '22222222-2222-2222-2222-222222222222'),
  ('dana',      '33333333-3333-3333-3333-333333333333'),
  ('omer_flat2','44444444-4444-4444-4444-444444444444');

insert into owners (id, name, email) values
  ('11111111-1111-1111-1111-111111111111', 'עומר', 'omer@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'מורן', 'moran@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'דנה',  'dana@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'הדירה השנייה של עומר', null);

-- The accounts behind them. accept_invite matches on the JWT's email and migration 054
-- joins auth.users to ask whether an accepted invitation actually produced a membership,
-- so an invitee with no account is a different test from an invitee with one.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'omer@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'moran@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'dana@example.com'),
  ('77777777-7777-7777-7777-777777777777', 'viewer@example.com')
on conflict (id) do nothing;

-- The trigger should already have made each creator a member of their own household.
-- (Counted over the cast only — migration 001 seeds an owner row of its own.)
do $$
begin
  if (select count(*) from household_members m join ids i on i.id = m.household_id
      where m.user_id = m.household_id) <> 4 then
    raise exception 'FAIL: creating a household did not make its creator a member (got %)',
      (select count(*) from household_members m join ids i on i.id = m.household_id
       where m.user_id = m.household_id);
  end if;
end $$;

-- Omer is in his second apartment too; Moran is invited into his first.
insert into household_members (household_id, user_id)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111')
on conflict do nothing;

insert into properties (id, owner_id, address, purchase_price) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'הדירה של עומר', 2180000),
  ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'הדירה השנייה',   900000),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'הדירה של דנה',  3000000);

insert into transactions (id, owner_id, direction, amount, date, category, description) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'income', 4500, current_date, 'שכר דירה', 'של עומר'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'income', 9999, current_date, 'שכר דירה', 'של דנה');

insert into storage.objects (bucket_id, name) values
  ('documents', '11111111-1111-1111-1111-111111111111/docs/omer.pdf'),
  ('documents', '33333333-3333-3333-3333-333333333333/docs/dana.pdf');

-- ── Becoming a user ──────────────────────────────────────────────────────────
create or replace function pg_temp.be(uid uuid, email text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'email', email)::text, false);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.check_count(label text, got bigint, want bigint) returns void
language plpgsql as $$
begin
  if got <> want then raise exception 'FAIL: % — expected %, got %', label, want, got; end if;
  raise notice 'ok · %', label;
end $$;

-- ── 1. Before any invitation: nothing changed for anyone ────────────────────
begin;
  select pg_temp.be('11111111-1111-1111-1111-111111111111', 'omer@example.com');
  select pg_temp.check_count('עומר רואה את שתי הדירות שלו', (select count(*) from properties), 2);
  select pg_temp.check_count('עומר לא רואה את הדירה של דנה',
    (select count(*) from properties where address = 'הדירה של דנה'), 0);
  select pg_temp.check_count('עומר לא רואה תנועות של דנה',
    (select count(*) from transactions where description = 'של דנה'), 0);
commit;

begin;
  select pg_temp.be('22222222-2222-2222-2222-222222222222', 'moran@example.com');
  select pg_temp.check_count('מורן עוד לא רואה כלום מעומר', (select count(*) from properties), 0);
commit;

-- ── 2. The invitation ────────────────────────────────────────────────────────
begin;
  select pg_temp.be('11111111-1111-1111-1111-111111111111', 'omer@example.com');
  insert into household_invites (id, household_id, email, invited_by)
  values ('cccccccc-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'moran@example.com',
          '11111111-1111-1111-1111-111111111111');
commit;

-- A stranger must not be able to see, or accept, an invitation addressed to someone else.
begin;
  select pg_temp.be('33333333-3333-3333-3333-333333333333', 'dana@example.com');
  select pg_temp.check_count('דנה לא רואה הזמנה שלא אליה', (select count(*) from household_invites), 0);
  do $$
  begin
    perform accept_invite('cccccccc-0000-0000-0000-000000000001');
    raise exception 'FAIL: דנה הצליחה לקבל הזמנה שלא אליה';
  exception
    when sqlstate 'P0001' then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'ok · דנה נדחתה: %', sqlerrm;
  end $$;
commit;

-- …and the rejection must not have let her in anyway.
do $$
begin
  if exists (select 1 from household_members
             where user_id = '33333333-3333-3333-3333-333333333333'
               and household_id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'FAIL: דנה נכנסה למשק הבית למרות הדחייה';
  end if;
end $$;

-- ── 3. Moran accepts ─────────────────────────────────────────────────────────
begin;
  select pg_temp.be('22222222-2222-2222-2222-222222222222', 'moran@example.com');
  select pg_temp.check_count('מורן רואה את ההזמנה שלה', (select count(*) from household_invites), 1);
  select accept_invite('cccccccc-0000-0000-0000-000000000001');

  select pg_temp.check_count('מורן רואה עכשיו את הדירה של עומר — ורק אותה',
    (select count(*) from properties), 1);
  select pg_temp.check_count('ולא את הדירה השנייה של עומר, שהיא לא חברה בה',
    (select count(*) from properties where address = 'הדירה השנייה'), 0);
  select pg_temp.check_count('מורן רואה את התנועות המשותפות',
    (select count(*) from transactions), 1);
  select pg_temp.check_count('ושום דבר של דנה',
    (select count(*) from transactions where description = 'של דנה'), 0);
  select pg_temp.check_count('מורן רואה את המסמכים המשותפים',
    (select count(*) from storage.objects), 1);

  -- Equal, not a viewer: she can write to the shared apartment.
  insert into transactions (owner_id, direction, amount, date, category, description)
  values ('11111111-1111-1111-1111-111111111111', 'expense', 300, current_date, 'תיקונים', 'מורן הוסיפה');
  select pg_temp.check_count('מורן יכולה לכתוב — היא שווה, לא צופה',
    (select count(*) from transactions where description = 'מורן הוסיפה'), 1);
commit;

-- She still must not be able to write into someone else's apartment.
begin;
  select pg_temp.be('22222222-2222-2222-2222-222222222222', 'moran@example.com');
  do $$
  begin
    insert into transactions (owner_id, direction, amount, date, category, description)
    values ('33333333-3333-3333-3333-333333333333', 'expense', 1, current_date, 'אחר', 'פריצה');
    raise exception 'FAIL: מורן כתבה לדירה של דנה';
  exception
    when insufficient_privilege then raise notice 'ok · כתיבה לדירה זרה נחסמה';
    when sqlstate 'P0001' then raise;
  end $$;
commit;

-- Omer sees her entry in the shared apartment.
begin;
  select pg_temp.be('11111111-1111-1111-1111-111111111111', 'omer@example.com');
  select pg_temp.check_count('עומר רואה את מה שמורן הוסיפה',
    (select count(*) from transactions where description = 'מורן הוסיפה'), 1);
commit;

-- Dana is entirely unaffected by any of it.
begin;
  select pg_temp.be('33333333-3333-3333-3333-333333333333', 'dana@example.com');
  select pg_temp.check_count('דנה רואה רק את הדירה שלה', (select count(*) from properties), 1);
  select pg_temp.check_count('דנה לא רואה תנועות של עומר או מורן',
    (select count(*) from transactions where owner_id <> '33333333-3333-3333-3333-333333333333'), 0);
  select pg_temp.check_count('ולא את המסמכים שלהם',
    (select count(*) from storage.objects where name like '1111%'), 0);
commit;

-- ── 4. Three, and no more ────────────────────────────────────────────────────
set role postgres;
insert into owners (id, name) values ('55555555-5555-5555-5555-555555555555', 'שלישי');
insert into household_members (household_id, user_id)
values ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555');

do $$
begin
  insert into owners (id, name) values ('66666666-6666-6666-6666-666666666666', 'רביעי');
  insert into household_members (household_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666');
  raise exception 'FAIL: נכנס אדם רביעי לדירה';
exception
  when sqlstate 'P0001' then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'ok · הרביעי נדחה: %', sqlerrm;
end $$;

-- ── 5. Leaving ───────────────────────────────────────────────────────────────
begin;
  select pg_temp.be('22222222-2222-2222-2222-222222222222', 'moran@example.com');
  delete from household_members
   where household_id = '11111111-1111-1111-1111-111111111111'
     and user_id = '22222222-2222-2222-2222-222222222222';
  select pg_temp.check_count('אחרי שמורן יוצאת, היא לא רואה יותר את הדירה',
    (select count(*) from properties), 0);
  select pg_temp.check_count('ולא את המסמכים',
    (select count(*) from storage.objects), 0);
commit;

-- …and what she wrote while she was a member stays with the apartment.
begin;
  select pg_temp.be('11111111-1111-1111-1111-111111111111', 'omer@example.com');
  select pg_temp.check_count('מה שהיא הוסיפה נשאר אצל עומר',
    (select count(*) from transactions where description = 'מורן הוסיפה'), 1);
commit;

-- ── 6. The two tables that must NOT be shared ────────────────────────────────
-- A device belongs to a person, and a message to the owner is that person's own.
set role postgres;
insert into push_subscriptions (owner_id, endpoint, p256dh, auth)
values ('11111111-1111-1111-1111-111111111111', 'https://push/omer', 'k', 'a');
insert into feedback (owner_id, note) values ('11111111-1111-1111-1111-111111111111', 'הערה של עומר');
insert into household_members (household_id, user_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

begin;
  select pg_temp.be('22222222-2222-2222-2222-222222222222', 'moran@example.com');
  select pg_temp.check_count('מורן חזרה ורואה את הדירה', (select count(*) from properties), 1);
  select pg_temp.check_count('אבל לא את ההתראות של עומר', (select count(*) from push_subscriptions), 0);
  select pg_temp.check_count('ולא את המשוב שלו', (select count(*) from feedback), 0);
commit;

-- ── 7. צופה בלבד — reads everything, changes nothing ────────────────────────
-- The second kind of membership (migration 052). The interesting assertions are the
-- negative ones: a viewer who can still write is not a viewer, and this is the only
-- place that can tell, because hiding a button in the client is a courtesy and not a
-- permission.
set role postgres;
insert into owners (id, name, email)
values ('77777777-7777-7777-7777-777777777777', 'צופה', 'viewer@example.com');
-- Free a place first: the apartment is at three after the tests above.
delete from household_members
 where household_id = '11111111-1111-1111-1111-111111111111'
   and user_id in ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555');
insert into household_members (household_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'viewer');

begin;
  select pg_temp.be('77777777-7777-7777-7777-777777777777', 'viewer@example.com');
  select pg_temp.check_count('צופה רואה את הדירה', (select count(*) from properties), 1);
  select pg_temp.check_count('צופה רואה את התנועות',
    (select count(*) from transactions where description = 'מורן הוסיפה'), 1);
  select pg_temp.check_count('צופה רואה את המסמכים', (select count(*) from storage.objects), 1);

  do $$
  begin
    insert into transactions (owner_id, direction, amount, date, category, description)
    values ('11111111-1111-1111-1111-111111111111', 'expense', 5, current_date, 'אחר', 'צופה כתב');
    raise exception 'FAIL: צופה הצליח להוסיף תנועה';
  exception
    when insufficient_privilege then raise notice 'ok · צופה לא יכול להוסיף';
    when sqlstate 'P0001' then raise;
  end $$;

  do $$
  declare n int;
  begin
    update transactions set amount = 1
     where owner_id = '11111111-1111-1111-1111-111111111111';
    get diagnostics n = row_count;
    -- An UPDATE blocked by RLS matches no rows rather than erroring, so "nothing changed"
    -- IS the refusal. Asserting the row count is the only way to see it.
    if n <> 0 then raise exception 'FAIL: צופה שינה % שורות', n; end if;
    raise notice 'ok · צופה לא יכול לערוך';
  end $$;

  do $$
  declare n int;
  begin
    delete from transactions where owner_id = '11111111-1111-1111-1111-111111111111';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: צופה מחק % שורות', n; end if;
    raise notice 'ok · צופה לא יכול למחוק';
  end $$;

  do $$
  begin
    insert into household_invites (household_id, email, invited_by)
    values ('11111111-1111-1111-1111-111111111111', 'stranger@example.com',
            '77777777-7777-7777-7777-777777777777');
    raise exception 'FAIL: צופה הזמין מישהו — זו העלאת דרגה בעקיפין';
  exception
    when insufficient_privilege then raise notice 'ok · צופה לא יכול להזמין';
    when sqlstate 'P0001' then raise;
  end $$;
commit;

-- Nothing the viewer attempted left a trace.
do $$
begin
  if exists (select 1 from transactions where description = 'צופה כתב') then
    raise exception 'FAIL: כתיבה של צופה נשמרה בכל זאת';
  end if;
  if exists (select 1 from transactions
             where owner_id = '11111111-1111-1111-1111-111111111111' and amount = 1) then
    raise exception 'FAIL: עריכה של צופה נשמרה בכל זאת';
  end if;
end $$;

-- The full member is unaffected by any of it.
begin;
  select pg_temp.be('11111111-1111-1111-1111-111111111111', 'omer@example.com');
  insert into transactions (owner_id, direction, amount, date, category, description)
  values ('11111111-1111-1111-1111-111111111111', 'expense', 7, current_date, 'אחר', 'עומר עדיין כותב');
  select pg_temp.check_count('שותף מלא ממשיך לכתוב כרגיל',
    (select count(*) from transactions where description = 'עומר עדיין כותב'), 1);
commit;

-- …and promoting the viewer gives writing back, without anything else changing.
set role postgres;
update household_members set role = 'member'
 where household_id = '11111111-1111-1111-1111-111111111111'
   and user_id = '77777777-7777-7777-7777-777777777777';

begin;
  select pg_temp.be('77777777-7777-7777-7777-777777777777', 'viewer@example.com');
  insert into transactions (owner_id, direction, amount, date, category, description)
  values ('11111111-1111-1111-1111-111111111111', 'expense', 9, current_date, 'אחר', 'אחרי קידום');
  select pg_temp.check_count('אחרי קידום — אותו אדם כבר כן כותב',
    (select count(*) from transactions where description = 'אחרי קידום'), 1);
commit;

-- ── 8. הזמנה חוזרת, והזמנה שאומרת של מי הדירה (053) ────────────────────────
set role postgres;
delete from household_invites;
delete from household_members
 where household_id = '11111111-1111-1111-1111-111111111111'
   and user_id <> '11111111-1111-1111-1111-111111111111';

begin;
  select pg_temp.be('11111111-1111-1111-1111-111111111111', 'omer@example.com');
  select upsert_invite('11111111-1111-1111-1111-111111111111', 'Moran@Example.com ', 'viewer',
                       'פסח חברוני 122', 'עומר');
  select pg_temp.check_count('הזמנה נוצרה', (select count(*) from household_invites), 1);

  -- Sending again must not fail and must not make a second row: same invitation, newly
  -- offered. This is what the unique constraint used to turn into a dead end.
  select upsert_invite('11111111-1111-1111-1111-111111111111', 'moran@example.com', 'member',
                       'פסח חברוני 122', 'עומר');
  select pg_temp.check_count('שליחה חוזרת לא יוצרת שורה שנייה',
    (select count(*) from household_invites), 1);
  select pg_temp.check_count('והדרגה התעדכנה למה שנשלח עכשיו',
    (select count(*) from household_invites where role = 'member'), 1);
  select pg_temp.check_count('הכתובת נשמרת מנורמלת',
    (select count(*) from household_invites where email = 'moran@example.com'), 1);
commit;

-- The invitee can read the label without being able to read the household itself — which
-- is the whole reason the label exists.
begin;
  select pg_temp.be('22222222-2222-2222-2222-222222222222', 'moran@example.com');
  select pg_temp.check_count('מורן רואה את ההזמנה', (select count(*) from household_invites), 1);
  select pg_temp.check_count('ורואה של מי הדירה',
    (select count(*) from household_invites
      where household_label = 'פסח חברוני 122' and invited_by_label = 'עומר'), 1);
  select pg_temp.check_count('בלי לראות את הדירה עצמה — היא עוד לא חברה בה',
    (select count(*) from properties), 0);
commit;

-- A stranger cannot invite into someone else's apartment, and cannot learn anything by
-- trying.
begin;
  select pg_temp.be('33333333-3333-3333-3333-333333333333', 'dana@example.com');
  do $$
  begin
    perform upsert_invite('11111111-1111-1111-1111-111111111111', 'x@example.com', 'member', null, null);
    raise exception 'FAIL: דנה הזמינה לדירה של עומר';
  exception
    when sqlstate 'P0001' then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'ok · דנה לא יכולה להזמין לדירה זרה: %', sqlerrm;
  end $$;
commit;

-- A viewer cannot invite through the function either — the policy and the function must
-- agree, or the function becomes the way around the policy.
set role postgres;
insert into household_members (household_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'viewer')
on conflict (household_id, user_id) do update set role = 'viewer';

begin;
  select pg_temp.be('77777777-7777-7777-7777-777777777777', 'viewer@example.com');
  do $$
  begin
    perform upsert_invite('11111111-1111-1111-1111-111111111111', 'y@example.com', 'member', null, null);
    raise exception 'FAIL: צופה הזמין דרך הפונקציה';
  exception
    when sqlstate 'P0001' then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'ok · צופה נחסם גם בפונקציה: %', sqlerrm;
  end $$;
commit;

-- ── Accepting must actually join (migration 054) ─────────────────────────────
-- The clause this replaces cost a day: `on conflict do nothing` with no target swallowed
-- the insert, the function stamped accepted_at anyway, and the invitation was spent from
-- both sides while nobody had been added to anything. The live database had exactly one
-- invitation and it was in that state.
set role postgres;
delete from household_members
 where household_id = '33333333-3333-3333-3333-333333333333'
   and user_id = '22222222-2222-2222-2222-222222222222';
delete from household_invites
 where household_id = '33333333-3333-3333-3333-333333333333'
   and lower(email) = 'moran@example.com';
insert into household_invites (household_id, email, role, invited_by)
values ('33333333-3333-3333-3333-333333333333', 'moran@example.com', 'viewer',
        '33333333-3333-3333-3333-333333333333');

begin;
  select pg_temp.be('22222222-2222-2222-2222-222222222222', 'moran@example.com');
  select accept_invite((select id from household_invites
                        where household_id = '33333333-3333-3333-3333-333333333333'
                          and lower(email) = 'moran@example.com'));
commit;

set role postgres;
select pg_temp.check_count('הצטרפות באמת מצרפת',
  (select count(*) from household_members
    where household_id = '33333333-3333-3333-3333-333333333333'
      and user_id = '22222222-2222-2222-2222-222222222222'), 1);
select pg_temp.check_count('התפקיד שהוצע הוא התפקיד שהתקבל',
  (select count(*) from household_members
    where household_id = '33333333-3333-3333-3333-333333333333'
      and user_id = '22222222-2222-2222-2222-222222222222' and role = 'viewer'), 1);
select pg_temp.check_count('הזמנה שנוצלה מסומנת ככזו',
  (select count(*) from household_invites
    where household_id = '33333333-3333-3333-3333-333333333333'
      and lower(email) = 'moran@example.com' and accepted_at is not null), 1);

-- Accepting again is not an error. She IS a member; telling her the invitation is spent
-- would be a claim about a state she can see for herself is fine.
begin;
  select pg_temp.be('22222222-2222-2222-2222-222222222222', 'moran@example.com');
  select accept_invite((select id from household_invites
                        where household_id = '33333333-3333-3333-3333-333333333333'
                          and lower(email) = 'moran@example.com'));
commit;
set role postgres;
select pg_temp.check_count('הצטרפות פעמיים לא מכפילה ולא נכשלת',
  (select count(*) from household_members
    where household_id = '33333333-3333-3333-3333-333333333333'
      and user_id = '22222222-2222-2222-2222-222222222222'), 1);

-- …and someone who was never invited still cannot get in through the function.
begin;
  select pg_temp.be('77777777-7777-7777-7777-777777777777', 'viewer@example.com');
  do $$
  begin
    perform accept_invite((select id from household_invites
                           where household_id = '33333333-3333-3333-3333-333333333333'
                             and lower(email) = 'moran@example.com'));
    raise exception 'FAIL: מישהו הצטרף עם הזמנה של מישהי אחרת';
  exception
    when sqlstate 'P0001' then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'ok · הזמנה של אחר לא מצרפת: %', sqlerrm;
  end $$;
commit;
set role postgres;
select pg_temp.check_count('הדירה של דנה לא קיבלה חבר לא-מוזמן',
  (select count(*) from household_members
    where household_id = '33333333-3333-3333-3333-333333333333'), 2);

-- And the repair: an invitation stamped accepted with no membership behind it reopens,
-- rather than staying spent for ever with nothing on either screen to say why.
delete from household_members
 where household_id = '33333333-3333-3333-3333-333333333333'
   and user_id = '22222222-2222-2222-2222-222222222222';
update household_invites i set accepted_at = null
 where i.accepted_at is not null
   and not exists (select 1 from auth.users u join household_members m
                     on m.household_id = i.household_id and m.user_id = u.id
                   where lower(u.email) = lower(i.email));
select pg_temp.check_count('הזמנה שלא צירפה אף אחד חוזרת להמתנה',
  (select count(*) from household_invites
    where household_id = '33333333-3333-3333-3333-333333333333'
      and lower(email) = 'moran@example.com' and accepted_at is null), 1);

set role postgres;
select 'ALL RLS CHECKS PASSED' as result;
