create table mortgages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  lender text,
  notes text,
  created_at timestamptz not null default now()
);
create index on mortgages (owner_id);
alter table mortgages enable row level security;
create policy "owner_scoped" on mortgages
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table mortgage_tracks (
  id uuid primary key default gen_random_uuid(),
  mortgage_id uuid not null references mortgages(id) on delete cascade,
  owner_id uuid not null references owners(id) on delete cascade,
  label text,
  track_type text not null,
  principal numeric(14,2) not null default 0,
  annual_rate numeric(6,3) not null default 0,
  term_months int not null default 0,
  start_date date not null,
  created_at timestamptz not null default now()
);
create index on mortgage_tracks (owner_id);
create index on mortgage_tracks (mortgage_id);
alter table mortgage_tracks enable row level security;
create policy "owner_scoped" on mortgage_tracks
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
