-- Feedback → Claude Code auto-fix pipeline (Section A).
-- Adds the pipeline lifecycle columns to the existing `feedback` table, and moves the
-- feedback "admin" (cross-user read/delete) from the dev@test.local manager account
-- BACK to the owner's real account itai.shubi@gmail.com — the owner manages the
-- feedback inbox + the auto-fix pipeline from their real login (migration 031 had
-- temporarily pointed it at the manager console).

-- ── Lifecycle columns ───────────────────────────────────────────────────────────
-- status: new → sent → in_progress → awaiting_review → fixed | failed. All nullable
-- except status (defaults to 'new'); existing rows backfill to 'new'. The 6-value
-- check keeps the pipeline from ever landing in an unknown state.
alter table feedback add column if not exists status text not null default 'new';
alter table feedback add column if not exists admin_notes text;
alter table feedback add column if not exists github_issue_number int;
alter table feedback add column if not exists github_pr_url text;
alter table feedback add column if not exists sent_at timestamptz;
alter table feedback add column if not exists status_updated_at timestamptz;

-- Constrain status to the 6 known values (added separately so re-runs are safe).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'feedback_status_check'
  ) then
    alter table feedback add constraint feedback_status_check
      check (status in ('new', 'sent', 'in_progress', 'awaiting_review', 'fixed', 'failed'));
  end if;
end $$;

-- Look up a row by its GitHub issue number fast (the status-update endpoint keys on it).
create index if not exists feedback_github_issue_number_idx on feedback (github_issue_number);

-- ── Move the feedback admin to the owner's real account ──────────────────────────
-- Writers still see/delete only their own rows (the owner_id = auth.uid() branch is
-- unchanged); only the cross-user admin branch moves to itai.shubi@gmail.com.
-- NOTE: no UPDATE policy exists (by design) — clients can never change status/PR.
-- Pipeline status writes go only through the service-role edge functions (Sections C/D).
alter policy "feedback_select_own_or_admin" on feedback
  using (owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com');

alter policy "feedback_delete_own_or_admin" on feedback
  using (owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com');

-- Same move for the feedback screenshot bucket, so the owner opens attached
-- screenshots from their real account (mirrors the table's admin-read policy).
alter policy "feedback_shot_select_own_or_admin" on storage.objects
  using (
    bucket_id = 'feedback'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com'
    )
  );

alter policy "feedback_shot_delete_own_or_admin" on storage.objects
  using (
    bucket_id = 'feedback'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com'
    )
  );
