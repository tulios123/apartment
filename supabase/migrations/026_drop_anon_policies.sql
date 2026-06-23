-- Multi-user hardening (before sharing the app with family).
-- Migration 002 created permissive `anon_all` policies (`to anon using(true)`) on
-- every data table, and 003 added open `anon_*` policies on the documents bucket.
-- Migration 006 added per-user `owner_scoped` (authenticated) policies but never
-- dropped these — so anyone holding the public anon key could read/write EVERY
-- user's data. Remove them; the authenticated owner_scoped policies are the sole
-- access path the app uses.

-- Data tables (from 002_rls_policies.sql)
drop policy if exists "anon_all" on owners;
drop policy if exists "anon_all" on properties;
drop policy if exists "anon_all" on contracts;
drop policy if exists "anon_all" on contract_utilities;
drop policy if exists "anon_all" on recurring_items;
drop policy if exists "anon_all" on transactions;
drop policy if exists "anon_all" on tasks;
drop policy if exists "anon_all" on documents;

-- Documents storage bucket (from 003). Per-user `auth_*` policies (006) already
-- enforce the first path segment = auth.uid().
drop policy if exists "anon_upload" on storage.objects;
drop policy if exists "anon_read" on storage.objects;
drop policy if exists "anon_delete" on storage.objects;
