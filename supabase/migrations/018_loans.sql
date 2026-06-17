-- Loans: liabilities separate from the bank mortgage.
-- Two kinds, distinguished by repayment_type:
--   'monthly_fixed' — supplementary bank loan, fixed monthly repayment (tracked under "התחייבויות")
--   'balloon'       — interest-free balloon, repaid only on sale (surfaced in the investment view)
create table loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  label text,
  lender text,
  repayment_type text not null default 'monthly_fixed',
  principal numeric(14,2) not null default 0,
  monthly_payment numeric(14,2),
  term_months int,
  start_date date,
  notes text,
  created_at timestamptz not null default now()
);
create index on loans (owner_id);
alter table loans enable row level security;
create policy "owner_scoped" on loans
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
