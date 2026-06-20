-- Stamp when a task is completed, powering the Property Admin "maintenance logbook".
-- Null while open; set to the completion moment when status flips to 'done'.
alter table tasks add column if not exists completed_at timestamptz;

-- Backfill existing done tasks so the logbook isn't empty (use created_at as best-effort).
update tasks set completed_at = created_at where status = 'done' and completed_at is null;
