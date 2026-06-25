-- Optional time-of-day for a task's due date. due_date stays a plain `date`
-- (the whole app compares date-only strings); due_time is an additive detail,
-- only meaningful when due_date is set. Stored as a zoneless `time`.
alter table tasks add column if not exists due_time time;
