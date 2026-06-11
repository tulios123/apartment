create table investment_costs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  category text not null,
  label text,
  amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index on investment_costs (owner_id);

alter table investment_costs enable row level security;
create policy "owner_scoped" on investment_costs
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
