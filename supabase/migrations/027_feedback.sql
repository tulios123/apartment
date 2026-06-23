-- In-app improvement notes. Anyone in the family can jot a suggestion; the app
-- owner (admin) can read everyone's. Writers see only their own.
create table feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  email text,
  note text not null,
  path text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on feedback (created_at desc);
alter table feedback enable row level security;

-- Any authenticated user can add their own note.
create policy "feedback_insert_own" on feedback
  for insert to authenticated
  with check (owner_id = auth.uid());

-- A writer sees their own notes; the admin (app owner) sees everyone's.
create policy "feedback_select_own_or_admin" on feedback
  for select to authenticated
  using (owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com');

-- A writer can remove their own; the admin can clear any.
create policy "feedback_delete_own_or_admin" on feedback
  for delete to authenticated
  using (owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com');
