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

set role postgres;
select 'ALL RLS CHECKS PASSED' as result;
