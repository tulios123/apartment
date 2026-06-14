-- Store the prime/anchor rate and margin separately for prime & variable tracks.
-- annual_rate stays the *effective* rate (prime + margin) used by all schedule
-- calculations; these columns let the edit form recover the original split
-- instead of collapsing it into the effective rate with a zero margin.
alter table mortgage_tracks
  add column if not exists prime_rate numeric(6,3),
  add column if not exists margin numeric(6,3);
