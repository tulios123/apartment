-- Optional screenshot attached to a feedback note. A family member can attach one
-- image (e.g. a screenshot of the bug they hit). Stored in a dedicated private
-- `feedback` bucket at {user_id}/{feedback_id}.{ext} — kept separate from the
-- financial `documents` bucket so an admin-read policy here never exposes documents.
-- The column is nullable, so existing rows and any older client keep working.
alter table feedback add column if not exists screenshot_path text;

-- Dedicated private bucket for feedback screenshots.
insert into storage.buckets (id, name, public)
values ('feedback', 'feedback', false)
on conflict (id) do nothing;

-- Family members upload only under their own {user_id}/ folder.
create policy "feedback_shot_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A writer reads their own shots; the app owner (admin) reads everyone's — mirrors
-- the feedback table's admin-read policy (migration 027) so the owner can open the
-- attached screenshot from Settings.
create policy "feedback_shot_select_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'feedback'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com'
    )
  );

-- A writer can remove their own; the admin can clear any.
create policy "feedback_shot_delete_own_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'feedback'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com'
    )
  );
