-- ============================================================
-- 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- OWNERS
-- Single user now; structure ready for multi-user later.
-- ============================================================
create table owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

-- Seed the single owner
insert into owners (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'itai');

-- ============================================================
-- PROPERTIES
-- ============================================================
create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  address text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONTRACTS
-- ============================================================
create table contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  company_name text not null,
  contact_name text,
  contact_phone text,
  start_date date not null,
  end_date date not null,
  monthly_rent numeric(10,2) not null,
  deposit numeric(10,2),
  -- renewal alert offsets in days, e.g. {90, 30}
  renewal_alert_days integer[] not null default '{90,30}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- UTILITY RESPONSIBILITIES
-- Per contract, per utility: who pays — tenant or owner.
-- ============================================================
create type utility_payer as enum ('tenant', 'owner');

create table contract_utilities (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  utility text not null, -- ארנונה | מים | חשמל | ועד בית
  payer utility_payer not null default 'tenant',
  constraint unique_contract_utility unique (contract_id, utility)
);

-- ============================================================
-- RECURRING ITEMS (templates)
-- ============================================================
create type direction as enum ('income', 'expense');
create type execution_type as enum ('automatic', 'requires_approval');

create table recurring_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  contract_id uuid references contracts(id) on delete set null,
  direction direction not null,
  amount numeric(10,2) not null,
  category text not null,
  day_of_month integer not null check (day_of_month between 1 and 28),
  start_date date not null,
  end_date date,
  payee text,
  execution_type execution_type not null default 'automatic',
  renewal_alert_days integer[] not null default '{90,30}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  contract_id uuid references contracts(id) on delete set null,
  recurring_item_id uuid references recurring_items(id) on delete set null,
  document_id uuid, -- populated after document upload; FK added below
  direction direction not null,
  amount numeric(10,2) not null,
  date date not null,
  category text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TASKS / REMINDERS
-- ============================================================
create type task_status as enum ('open', 'done');
create type task_source as enum ('manual', 'recurring_item', 'renewal');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  recurring_item_id uuid references recurring_items(id) on delete set null,
  transaction_id uuid references transactions(id) on delete set null,
  title text not null,
  due_date date,
  category text not null default 'כללי',
  status task_status not null default 'open',
  source task_source not null default 'manual',
  is_recurring boolean not null default false,
  recurrence_days integer,
  created_at timestamptz not null default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create type document_type as enum (
  'purchase_contract',
  'property_photos',
  'rental_contract',
  'insurance_policy',
  'receipt',
  'invoice',
  'other'
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  transaction_id uuid references transactions(id) on delete set null,
  type document_type not null default 'other',
  name text not null,
  storage_path text not null,
  date date,
  created_at timestamptz not null default now()
);

-- Add the FK from transactions → documents now that documents table exists
alter table transactions
  add constraint fk_transaction_document
  foreign key (document_id) references documents(id) on delete set null;

-- ============================================================
-- INDEXES
-- ============================================================
create index on transactions (owner_id, date desc);
create index on transactions (recurring_item_id);
create index on tasks (owner_id, status, due_date);
create index on recurring_items (owner_id);
create index on documents (owner_id);
