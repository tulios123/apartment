-- Multiple screenshots per feedback item (was a single screenshot_path). A reporter can
-- attach several images and add/remove them; the owner can attach some too. Files still
-- live in the private 'feedback' bucket under {uid}/… so the existing folder-based storage
-- RLS (034/038) already covers many files + per-file delete — no storage-policy change.

-- The list of storage paths. Non-null with an empty-array default so app code never has to
-- null-check. The legacy single screenshot_path stays (kept in sync to paths[0] by the app)
-- so any straggler reader still gets the first image.
alter table feedback add column if not exists screenshot_paths text[] not null default '{}';

-- Backfill: fold the existing single screenshot into the array.
update feedback
  set screenshot_paths = array[screenshot_path]
  where screenshot_path is not null
    and (screenshot_paths is null or screenshot_paths = '{}');

-- The client/admin upload files then UPDATE the row with the paths, so add screenshot_paths
-- to the authenticated update grant (mirrors screenshot_path; re-granting the full set is a
-- no-op for the already-granted columns, so this is safe to re-run). status/archived_at/etc.
-- stay out of the grant — service-role only, unchanged.
grant update (note, admin_notes, screenshot_path, screenshot_paths) on feedback to authenticated;
