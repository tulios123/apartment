-- Enough of Supabase to run this project's migrations on a plain Postgres.
--
-- The point is not to emulate Supabase; it is to make the RLS policies executable so
-- their BEHAVIOUR can be asserted. Everything here is the part the policies actually
-- touch: who the caller is, what their JWT says, and the storage object table.

create schema if not exists auth;
create schema if not exists storage;

-- The roles the policies name.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Supabase derives both of these from the request's JWT, which it puts in a GUC.
-- Same mechanism here, so a test can "become" a user by setting one setting.
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

-- Buckets are created by the migrations themselves; they only need somewhere to land.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

-- Realtime publication — 039 adds a table to it.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Storage: only the columns and helper the policies read.
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema storage grant all on tables to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
