-- Add google_task_id to tasks for two-way Google Tasks sync
alter table tasks add column if not exists google_task_id text unique;
