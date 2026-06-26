-- EDGE-07: make monthly generation idempotent at the DB layer.
-- The client guard (module-level `inFlight` + in-memory id sets) is per-JS-context,
-- so two devices/tabs opening in the same month can both read "nothing generated"
-- and both insert → duplicate generated transactions/tasks. These unique indexes
-- close the race: the second insert is rejected (the app upserts with ON CONFLICT
-- DO NOTHING).
--
-- Note: Postgres treats NULLs as DISTINCT in a unique index, so manual rows (which
-- have recurring_item_id IS NULL) are unaffected — only GENERATED rows, which always
-- carry a recurring_item_id, are de-duplicated. No partial predicate needed.

create unique index if not exists uniq_generated_tx
  on transactions (owner_id, recurring_item_id, date);

create unique index if not exists uniq_generated_task
  on tasks (owner_id, recurring_item_id, due_date);
