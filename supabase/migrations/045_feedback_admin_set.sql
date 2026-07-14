-- Widen the feedback "admin" from a single hardcoded email to a SET, so the owner's
-- dedicated management account (tuliosking@gmail.com — a real Google account that logs into
-- the installed iOS PWA reliably) has the SAME cross-user admin access as itai.shubi@gmail.com.
--
-- ADDITIVE + reversible: itai.shubi@gmail.com stays an admin; this only ADDS tuliosking. No
-- policy is dropped — each is changed in place with ALTER POLICY (no exposure gap), and only
-- the email literal is swapped for a central helper. The owner_id = auth.uid() ("this is my
-- own row") branches are preserved verbatim, so every family member's own-row access is
-- untouched. To change the admin set in the future, edit ONLY the function below.
--
-- Mirrors: src/lib/admin.ts (ADMIN_SET) on the client, and the FEEDBACK_ADMIN_EMAILS secret
-- read by supabase/functions/_shared/admin.ts at runtime.

-- ── Central admin predicate ──────────────────────────────────────────────────────
-- STABLE + SECURITY INVOKER (default): runs in the caller's request context, so auth.jwt()
-- reads the caller's own JWT. A missing/blank email (service role, anon) → not in the set →
-- false; the service role bypasses RLS entirely regardless.
create or replace function public.is_feedback_admin() returns boolean
  language sql
  stable
  as $$
    select coalesce(auth.jwt() ->> 'email', '') in ('itai.shubi@gmail.com', 'tuliosking@gmail.com')
  $$;

grant execute on function public.is_feedback_admin() to authenticated, anon, service_role;

-- ── feedback: cross-user read / delete / admin-update ────────────────────────────
alter policy "feedback_select_own_or_admin" on feedback
  using (owner_id = auth.uid() or public.is_feedback_admin());

alter policy "feedback_delete_own_or_admin" on feedback
  using (owner_id = auth.uid() or public.is_feedback_admin());

alter policy "feedback_update_admin" on feedback
  using (public.is_feedback_admin())
  with check (public.is_feedback_admin());

-- ── storage.objects: read / delete any attached screenshot (mirrors feedback read) ─
alter policy "feedback_shot_select_own_or_admin" on storage.objects
  using (
    bucket_id = 'feedback'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_feedback_admin()
    )
  );

alter policy "feedback_shot_delete_own_or_admin" on storage.objects
  using (
    bucket_id = 'feedback'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_feedback_admin()
    )
  );

-- ── feedback_messages: admin reads every thread (both channels) + posts admin replies ─
-- Preserves the 041 channel wall: a reporter still reads ONLY their own item's client-channel
-- messages; an admin reads all. Only the admin-email literal is swapped for the helper.
alter policy "feedback_msg_select" on feedback_messages
  using (
    public.is_feedback_admin()
    or (
      channel = 'client'
      and exists (
        select 1 from feedback f
        where f.id = feedback_messages.feedback_id
          and f.owner_id = auth.uid()
      )
    )
  );

alter policy "feedback_msg_insert_admin" on feedback_messages
  with check (
    author = 'admin'
    and channel = 'client'
    and public.is_feedback_admin()
    and author_id = auth.uid()
  );
