-- Add purchase contract fields to properties table
alter table properties
  add column if not exists buyer_name text,
  add column if not exists block_parcel text,
  add column if not exists purchase_price numeric(14,2),
  add column if not exists purchase_date date,
  add column if not exists key_delivery_date date,
  add column if not exists property_size_sqm numeric(8,2),
  add column if not exists floor integer;
