-- Fix privacy: replace permissive authenticated_all policies with user-scoped ones.
-- Each user can only access rows where owner_id = auth.uid().
-- Also add authenticated-role storage policies (previously only anon had them).

-- ── Database RLS ─────────────────────────────────────────────────────────────

drop policy if exists "authenticated_all" on owners;
drop policy if exists "authenticated_all" on properties;
drop policy if exists "authenticated_all" on contracts;
drop policy if exists "authenticated_all" on contract_utilities;
drop policy if exists "authenticated_all" on recurring_items;
drop policy if exists "authenticated_all" on transactions;
drop policy if exists "authenticated_all" on tasks;
drop policy if exists "authenticated_all" on documents;

create policy "owner_scoped" on owners
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "owner_scoped" on properties
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_scoped" on contracts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- contract_utilities has no owner_id; gate through contracts
create policy "owner_scoped" on contract_utilities
  for all to authenticated
  using (
    contract_id in (select id from contracts where owner_id = auth.uid())
  )
  with check (
    contract_id in (select id from contracts where owner_id = auth.uid())
  );

create policy "owner_scoped" on recurring_items
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_scoped" on transactions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_scoped" on tasks
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_scoped" on documents
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── Storage RLS ───────────────────────────────────────────────────────────────
-- Files are stored at {user_id}/docs/... and {user_id}/receipts/...
-- Scope access to the folder matching the caller's user ID.

create policy "auth_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "auth_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
