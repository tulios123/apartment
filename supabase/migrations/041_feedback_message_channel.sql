-- Feedback chat — separate the CLIENT conversation from the BOT conversation.
--
-- Until now feedback_messages was a single thread and the admin console split it by author
-- ('bot' vs the rest). But the owner now also TYPES to the auto-fix bot (guidance/answers),
-- and those messages must NEVER reach the reporting family member. Add a `channel` so every
-- message belongs to exactly one conversation:
--   'client' — owner ↔ reporter (+ the 'system' resolution notice the reporter should see)
--   'bot'    — owner ↔ auto-fix bot (guidance in, questions/summaries back) — admin-only
-- RLS hides the 'bot' channel from the reporter entirely (row-level, so it can't be
-- bypassed by a hand-crafted client query).

alter table feedback_messages add column if not exists channel text not null default 'client'
  check (channel in ('client', 'bot'));

-- Existing bot messages lived on the single thread as author='bot' — move them into the
-- bot channel. 'system' (resolution notices) and 'admin'/'client' replies are client-facing,
-- so they correctly keep the default 'client'.
update feedback_messages set channel = 'bot' where author = 'bot' and channel <> 'bot';

-- The authenticated role may now also set `channel` on insert (still pinned per policy).
grant insert (feedback_id, author, author_id, author_email, body, channel) on feedback_messages to authenticated;

-- ── READ: reporter sees only their own item's CLIENT-channel messages; admin sees all ────
-- This is the wall that keeps owner↔bot chatter away from the reporter.
drop policy if exists "feedback_msg_select" on feedback_messages;
create policy "feedback_msg_select" on feedback_messages
  for select to authenticated
  using (
    (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com'
    or (
      channel = 'client'
      and exists (
        select 1 from feedback f
        where f.id = feedback_messages.feedback_id
          and f.owner_id = auth.uid()
      )
    )
  );

-- ── INSERT (client): reply on their OWN item, forced author='client' AND channel='client' ─
-- A reporter can never post into the bot channel.
drop policy if exists "feedback_msg_insert_client" on feedback_messages;
create policy "feedback_msg_insert_client" on feedback_messages
  for insert to authenticated
  with check (
    author = 'client'
    and channel = 'client'
    and author_id = auth.uid()
    and exists (
      select 1 from feedback f
      where f.id = feedback_messages.feedback_id
        and f.owner_id = auth.uid()
    )
  );

-- ── INSERT (admin): reply to the reporter, forced author='admin' AND channel='client' ─────
-- Owner→bot messages do NOT go through RLS — the send-bot-followup edge fn writes them with
-- the service role (channel='bot') because it must also post to GitHub + re-trigger the run.
-- So the admin's only RLS-insert path is a client reply; keeping this tight to 'client'
-- means even the admin can't accidentally land a bot-channel row via a plain insert.
drop policy if exists "feedback_msg_insert_admin" on feedback_messages;
create policy "feedback_msg_insert_admin" on feedback_messages
  for insert to authenticated
  with check (
    author = 'admin'
    and channel = 'client'
    and (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com'
    and author_id = auth.uid()
  );

-- No UPDATE/DELETE for authenticated (unchanged) — chat history stays append-only.
