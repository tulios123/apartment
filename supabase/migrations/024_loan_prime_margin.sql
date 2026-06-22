-- Prime/variable loan tracks need the anchor + margin split (e.g. "פריים מינוס 0.5"),
-- mirroring mortgage_tracks (migration 016). annual_rate stays the effective rate
-- (anchor + margin) that drives the Shpitzer schedule; these recover the split for editing.
alter table loans
  add column if not exists prime_rate numeric(6,3),
  add column if not exists margin numeric(6,3);
