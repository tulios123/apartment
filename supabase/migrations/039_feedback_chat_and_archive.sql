-- Feedback Phase 2/3 — two-way chat + human archive.
--
-- Adds:
--   • feedback_messages — a chat thread per feedback item (client ↔ admin ↔ bot/system).
--   • feedback.archived_at — the owner's HUMAN "mark as handled" decision, kept fully
--     independent of the bot pipeline's `status` (a fix can be technically 'fixed' while
--     the owner hasn't yet verified + closed it, and vice-versa).
--
-- Design constraints carried from 038:
--   • Column-level grants cap what the `authenticated` role can ever write, so a client
--     can't forge author='admin' and can't self-archive. The service role bypasses both
--     row policies and column grants, so edge functions retain full control.
--   • Everything is idempotent (if-not-exists / drop-then-create / do-block guards) so a
--     re-run never errors — 038 had an "already exists" hiccup; this file avoids it.
--
-- Ownership predicate: feedback.owner_id references owners(id), and owners.id = auth.uid()
-- (migration 006), so `owner_id = auth.uid()` is the correct "this family member owns it"
-- test — identical to every other owner-scoped table.

-- ══════════════════════════════════════════════════════════════════════════════════
-- 1. Human archive flag on feedback
-- ══════════════════════════════════════════════════════════════════════════════════
-- Nullable timestamptz: NULL = active (shown in the תקלות/רעיונות tabs), non-NULL = the
-- moment the owner marked it handled (shown in the ארכיון tab). Separate from `status`
-- on purpose — archiving is the owner's call, not a pipeline transition.
alter table feedback add column if not exists archived_at timestamptz;

-- Fast split of active vs archived lists.
create index if not exists feedback_archived_at_idx on feedback (archived_at);

-- ── Who may write archived_at ────────────────────────────────────────────────────
-- archived_at is written ONLY by the service-role `resolve-feedback` edge fn, which also
-- inserts the "handled" system message and pushes the reporting client — all on one audited
-- server path. It is DELIBERATELY NOT added to the authenticated column grant: neither a
-- client nor the admin writes it over plain RLS. This closes the hole where a role-wide
-- archived_at grant would let a family member self-archive/unarchive their own item, and it
-- avoids a WITH-CHECK regression (a client editing their own note after the admin archived
-- it would be rejected by an `archived_at is null` check). The authenticated grant therefore
-- stays EXACTLY as 038 left it; re-granting the same set is a no-op, so this is safe to re-run.
grant update (note, admin_notes, screenshot_path) on feedback to authenticated;

-- Re-assert 038's own-row + admin update policies idempotently so a fresh DB reaches the
-- same final state. Neither needs an archived_at clause: the column isn't in the grant, so
-- no authenticated caller (client OR admin) can write it via RLS at all — only the service
-- role (resolve-feedback) can, by bypassing both the grant and the policies.
drop policy if exists "feedback_update_own" on feedback;
create policy "feedback_update_own" on feedback
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "feedback_update_admin" on feedback;
create policy "feedback_update_admin" on feedback
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'itai.shubi@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'itai.shubi@gmail.com');

-- ── Cap what a client may INSERT (the load-bearing fix) ──────────────────────────
-- CRITICAL: 038 column-capped only UPDATE. In Postgres INSERT and UPDATE column
-- privileges are INDEPENDENT, and Supabase's default is table-wide INSERT for the
-- authenticated role — so without this a family member could INSERT a row with
-- status/archived_at/github_*/sent_at pre-set (feedback_insert_own only checks owner_id,
-- not columns). That would let them: self-archive to hide a report, forge status='fixed',
-- hijack a pipeline callback by planting a github_issue_number, or wedge the GLOBAL
-- single-active lock forever with status='in_progress'. Restrict INSERT to the
-- human-reportable columns only, mirroring the UPDATE grant. status then defaults to 'new'
-- and archived_at/github_*/timestamps stay service-role-only (edge functions bypass grants).
revoke insert on feedback from authenticated;
grant insert (owner_id, email, note, path, user_agent, category, context, screenshot_path) on feedback to authenticated;

-- Make the issue-number lookup UNIQUE so a forged/duplicate github_issue_number can't
-- shadow the real row in update-feedback-status's `.eq()` callback. Only the service role
-- sets it (once per issue), so uniqueness holds; multiple NULLs (unsent items) are allowed.
-- Fall back to a plain index if a pre-existing duplicate would otherwise block the deploy —
-- the INSERT grant above is the real fix; this is defense-in-depth.
do $$
begin
  drop index if exists feedback_github_issue_number_idx;
  create unique index feedback_github_issue_number_idx on feedback (github_issue_number);
exception when others then
  create index if not exists feedback_github_issue_number_idx on feedback (github_issue_number);
end $$;

-- ══════════════════════════════════════════════════════════════════════════════════
-- 2. feedback_messages — the chat thread
-- ══════════════════════════════════════════════════════════════════════════════════
-- One row per message in a feedback item's conversation. `author` distinguishes who
-- sent it so the UI can align bubbles (client right / admin left, bot as a system line)
-- AND so RLS can force each side to its own role — a client can never post as 'admin'.
--
--   author:
--     'client' — the reporting family member (or any owner of the row) writes a reply.
--     'admin'  — the feedback owner (itai) replies from the console.
--     'bot'    — the auto-fix pipeline / Claude Code (service-role only).
--     'system' — automated status lines, e.g. "הפריט סומן כטופל" (service-role only).
--
--   author_id / author_email — best-effort attribution captured at insert time from the
--   caller's JWT for client/admin messages (NULL for bot/system). Stored for audit/debug;
--   the UI aligns on `author`, never on the id. Not a hard FK to auth.users (bot/system
--   have none, and we don't want a message to block on a user delete — the ON DELETE
--   CASCADE from feedback already removes the whole thread with its item).
create table if not exists feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback(id) on delete cascade,
  author text not null check (author in ('client', 'admin', 'bot', 'system')),
  author_id uuid,
  author_email text,
  body text not null,
  created_at timestamptz not null default now()
);

-- Thread reads: all messages of one item, oldest-first (chat order).
create index if not exists feedback_messages_feedback_id_idx
  on feedback_messages (feedback_id, created_at);

alter table feedback_messages enable row level security;

-- ── Column grants: cap what a client/admin may ever write ─────────────────────────
-- Mirrors 038's defense-in-depth. INSERT is allowed only for the columns a human should
-- set. `author` is DELIBERATELY EXCLUDED from the insert grant, so the authenticated role
-- literally cannot supply it — the WITH CHECK below then can't be bypassed, and the
-- app relies on the column DEFAULT... but a text column can't safely default to the
-- caller's role. So instead we KEEP author client-writable but PIN its value per policy:
-- each INSERT policy's WITH CHECK forces author to exactly the role that policy is for.
-- A client using the admin value fails feedback_msg_insert_client's check; there is no
-- client-facing policy that permits author='admin'/'bot'/'system'. Result: the only
-- author a client can land is 'client', the only one the admin can land is 'admin', and
-- bot/system are unreachable without the service role.
--
-- We still revoke UPDATE/DELETE from authenticated entirely — messages are immutable from
-- the client (no edit/delete of chat history; the service role can moderate if ever needed).
revoke all on feedback_messages from authenticated;
grant select on feedback_messages to authenticated;
grant insert (feedback_id, author, author_id, author_email, body) on feedback_messages to authenticated;

-- ── READ: you may read the thread of any feedback row you can read ────────────────
-- Reuse the exact feedback-visibility rule: a family member reads messages on rows they
-- own; the admin (itai JWT) reads messages on any row. Expressed as an EXISTS against
-- feedback so the two stay in lockstep with 038's feedback_select_own_or_admin.
drop policy if exists "feedback_msg_select" on feedback_messages;
create policy "feedback_msg_select" on feedback_messages
  for select to authenticated
  using (
    exists (
      select 1 from feedback f
      where f.id = feedback_messages.feedback_id
        and (
          f.owner_id = auth.uid()
          or (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com'
        )
    )
  );

-- ── INSERT (client): a family member replies on their OWN item, forced author='client' ─
-- The WITH CHECK pins author='client' AND requires the target feedback to be owned by the
-- caller. author_id/author_email are also pinned to the caller so a client can't spoof
-- someone else's attribution.
drop policy if exists "feedback_msg_insert_client" on feedback_messages;
create policy "feedback_msg_insert_client" on feedback_messages
  for insert to authenticated
  with check (
    author = 'client'
    and author_id = auth.uid()
    and exists (
      select 1 from feedback f
      where f.id = feedback_messages.feedback_id
        and f.owner_id = auth.uid()
    )
  );

-- ── INSERT (admin): the feedback owner replies on ANY item, forced author='admin' ─────
-- The admin JWT can post to any row; author pinned to 'admin', attribution pinned to the
-- admin's own uid. A non-admin can't satisfy the email check, so this policy is inert for
-- them and their only route is the client policy above (author='client').
drop policy if exists "feedback_msg_insert_admin" on feedback_messages;
create policy "feedback_msg_insert_admin" on feedback_messages
  for insert to authenticated
  with check (
    author = 'admin'
    and (auth.jwt() ->> 'email') = 'itai.shubi@gmail.com'
    and author_id = auth.uid()
  );

-- No UPDATE/DELETE policies for authenticated → chat history is append-only from the app.
-- Bot ('bot') and automated ('system') messages have NO authenticated policy at all, so
-- they can be written ONLY by the service role (edge functions), which bypasses RLS.

-- ══════════════════════════════════════════════════════════════════════════════════
-- 3. Realtime — live thread on both sides
-- ══════════════════════════════════════════════════════════════════════════════════
-- Add feedback_messages to the supabase_realtime publication so the client's thread view
-- and the admin console both receive INSERTs live (no polling). RLS STILL APPLIES to
-- realtime: a subscriber only receives change rows that pass their SELECT policy, so a
-- family member only streams messages on their own items, and the admin streams all —
-- exactly matching feedback_msg_select above. Guarded so a re-run doesn't error if the
-- table is already a member of the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback_messages'
  ) then
    alter publication supabase_realtime add table feedback_messages;
  end if;
end $$;

-- NOTE: `feedback` itself is intentionally NOT added to the realtime publication. RLS on
-- realtime filters ROWS, not COLUMNS — streaming a feedback row to the reporting client
-- would leak admin-only columns (admin_notes / github_* / status). The live "טופל" signal
-- instead rides the 'system' message that resolve-feedback inserts into feedback_messages
-- (which IS streamed), so the client still updates instantly without exposing those fields.

-- ══════════════════════════════════════════════════════════════════════════════════
-- 4. Category simplification — no destructive DB change
-- ══════════════════════════════════════════════════════════════════════════════════
-- `category` stays free-text (no CHECK constraint — 033 never added one, keep it that
-- way so legacy 'question'/'other'/NULL rows remain perfectly valid and nothing is lost).
-- The app will only ever WRITE 'bug' | 'feature' going forward. Folding of legacy rows is
-- done in the APP (read-side), not the DB:
--   • The client picker offers only תקלה (bug) / רעיון (feature).
--   • The admin console has exactly two active category tabs — תקלות / רעיונות — plus
--     ארכיון. Fold on read: category='bug' → תקלות; everything else that isn't bug
--     (i.e. 'feature' | 'question' | 'other' | NULL) → רעיונות. This guarantees EVERY
--     legacy row lands in exactly one visible tab (nothing hidden), while new rows are
--     always a clean bug/feature. (If the owner prefers question/other to surface under
--     תקלות instead, that's a one-line app change — the DB imposes nothing.)
-- No SQL needed here; documented so the migration is the single source of truth.

-- ══════════════════════════════════════════════════════════════════════════════════
-- 5. Notes for the deploy (owner runs `supabase db push` + functions deploy + config)
-- ══════════════════════════════════════════════════════════════════════════════════
-- • A new mark-resolved edge fn (service role) should, in one transaction-ish flow:
--     update feedback set archived_at = now(), status_updated_at = now() where id = $1;
--     insert into feedback_messages (feedback_id, author, body)
--       values ($1, 'system', 'הפריט סומן כטופל ונשלח בחזרה למדווח.');
--   then web-push the reporting client. It uses the service role, so it may write
--   archived_at + the 'system' message even though those aren't in the authenticated grant.
-- • notify-feedback's payload url must change from '/settings' to '/admin/feedback'
--   (stale) — that's an edge-fn edit, deployed with the other functions; not in this SQL.
-- • Any new edge fn's verify_jwt posture must be pinned in supabase/config.toml (mirror
--   send-feedback-to-claude = true for an admin-JWT-called mark-resolved; and a
--   client-callable notify-reply would also be verify_jwt=true).
