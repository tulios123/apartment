-- Housekeeping (found by the live RLS verification, 2026-07-08).
-- The live DB carried 7 extra "owner_access" policies — created out-of-band (dashboard),
-- not by any migration — on: contracts, documents, owners, properties, recurring_items,
-- tasks, transactions. UNLIKE the contract_utilities one (migration 035, which was
-- USING true — a real hole), these are correctly scoped: USING (auth.uid() = owner_id)
-- (owners: = id). So they are NOT a leak — an anon caller gets nothing (auth.uid() is
-- null). But they duplicate the migration-defined "owner_scoped" policy and grant to the
-- broader `public` role, so the live DB drifts from the code. Drop them; "owner_scoped"
-- (to authenticated, identical qual) fully covers every one — no access is lost.
drop policy if exists "owner_access" on contracts;
drop policy if exists "owner_access" on documents;
drop policy if exists "owner_access" on owners;
drop policy if exists "owner_access" on properties;
drop policy if exists "owner_access" on recurring_items;
drop policy if exists "owner_access" on tasks;
drop policy if exists "owner_access" on transactions;
