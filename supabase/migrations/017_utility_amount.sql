-- Add optional monthly amount for owner-paid utilities
ALTER TABLE contract_utilities
  ADD COLUMN IF NOT EXISTS amount numeric(10,2) DEFAULT NULL;
