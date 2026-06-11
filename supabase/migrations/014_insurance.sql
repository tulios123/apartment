create table insurance_policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  type text not null default 'מבנה',
  company text,
  policy_number text,
  monthly_premium numeric(14,2),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now()
);
create index on insurance_policies (owner_id);

alter table insurance_policies enable row level security;
create policy "owner_scoped" on insurance_policies
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
