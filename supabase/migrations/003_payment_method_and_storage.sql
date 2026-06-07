-- Payment method on transactions and recurring items
alter table transactions
  add column payment_method text;

alter table recurring_items
  add column payment_method text;

-- Storage bucket for documents/receipts
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage RLS: anon can upload, read, delete
create policy "anon_upload" on storage.objects
  for insert to anon
  with check (bucket_id = 'documents');

create policy "anon_read" on storage.objects
  for select to anon
  using (bucket_id = 'documents');

create policy "anon_delete" on storage.objects
  for delete to anon
  using (bucket_id = 'documents');
