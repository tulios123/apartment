-- The rent the owner EXPECTS to collect, as distinct from a signed contract's rent.
--
-- A buyer who hasn't taken delivery has no lease and therefore no income figure, so
-- every forward-looking screen reads as zero for them. Most buyers do know roughly what
-- the flat will let for — it is usually why they bought it — and that one number is what
-- turns the mortgage engine's output into the answer they actually want: what the month
-- will look like once it is let. Always shown as an estimate, never as fact.
--
-- Nullable + additive, so every existing row and every running client keeps working
-- unchanged; nothing backfills, and no code reads it until the feature ships.
alter table properties add column if not exists expected_monthly_rent numeric
  check (expected_monthly_rent is null or expected_monthly_rent >= 0);
