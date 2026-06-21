-- Allow documents (receipts/photos) to be attached to a task, mirroring the
-- existing transaction_id / contract_id / property_id linkages.
alter table documents add column if not exists task_id uuid references tasks(id) on delete set null;

create index if not exists documents_task_id_idx on documents(task_id);
