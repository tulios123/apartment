-- Phase 2 (staging pipeline): add the 'in_staging' status (Hebrew: בבדיקות). A bot fix now
-- auto-merges into the `staging` branch and sits in 'in_staging' until the owner presses
-- "פרסם לכולם", which promotes staging→main and flips all in_staging rows → 'fixed'.
--
-- ADDITIVE + backward-compatible: it only WIDENS the allowed set, so it is safe to apply to
-- the shared database while production code — which never writes this value — keeps running
-- against it. (This is the migration-safety rule the staging pipeline depends on.)
alter table feedback drop constraint if exists feedback_status_check;
alter table feedback add constraint feedback_status_check
  check (status in ('new', 'sent', 'in_progress', 'awaiting_review', 'in_staging', 'fixed', 'failed'));
