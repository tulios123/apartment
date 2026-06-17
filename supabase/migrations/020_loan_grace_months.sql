-- Add grace period (interest-only months at start) to supplementary loans,
-- matching the same concept already present on mortgage_tracks.
alter table loans add column grace_months int;
