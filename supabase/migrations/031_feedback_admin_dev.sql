-- Move the feedback "admin" (cross-user read/delete) from the owner's personal
-- email to the dev@test.local manager account, so feedback is reviewed from the
-- manager console rather than the owner's family account. Each writer still
-- sees/deletes only their own (the owner_id = auth.uid() branch is unchanged).
-- Mirrors MANAGER_EMAIL in src/pages/Settings.tsx.
alter policy "feedback_select_own_or_admin" on feedback
  using (owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'dev@test.local');

alter policy "feedback_delete_own_or_admin" on feedback
  using (owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'dev@test.local');
