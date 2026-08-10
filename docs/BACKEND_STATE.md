# Backend state that lives ONLY in dashboards (not in git)

The code, schema (47 migrations), and edge functions are all in git and reproduce a
backend. But some configuration exists **only** in the Supabase / Cloudflare / GitHub
dashboards and cannot be recovered from a clone. If you ever rebuild the backend from
scratch (new Supabase project), you must recreate each item below by hand. If you keep
using the existing hosted project (`bjholzkesnzkbogxmurw`), it all already exists there.

**Owner: fill in the blanks from your phone while you still can — some of these
(the cron schedule especially) are otherwise undiscoverable.**

---

## 1. Supabase — daily-reminders cron schedule  ⬅ most important, undiscoverable from git
The `daily-reminders` edge function sends the push reminders, but **what triggers it on
a schedule is not in any migration**. Find and record it:
- Supabase Dashboard → your project → **Integrations → Cron** (older UIs: **Database →
  Cron Jobs**, or **Edge Functions → daily-reminders → Schedules**). It may instead be a
  `pg_cron` job — check **Database → Extensions** for `pg_cron` enabled, then the
  **SQL editor**: `select * from cron.job;`
- Record here:  schedule (cron expression, e.g. `0 6 * * *`) = ` __________ `
  timezone = ` __________ `  ; how it calls the function (net.http_post URL + the
  `CRON_SECRET` header, or a Supabase scheduled-function trigger) = ` __________ `

## 2. Supabase — Edge Function secrets (set via `supabase secrets set`, not in git)
Recreate each in Dashboard → **Edge Functions → Secrets** (or `supabase secrets list`).
Names only — never paste the values into git. Full list also in `.env.example` footer:
- `SUPABASE_SERVICE_ROLE_KEY` (auto), `ANTHROPIC_API_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `PIPELINE_SECRET`, `GITHUB_PAT`,
  `GITHUB_REPO`, `FEEDBACK_ADMIN_EMAIL(S)`, `FEEDBACK_NOTIFY_EMAIL`,
  `CLIENT_THREAD_URL_TEMPLATE`.
- Which are currently set? (confirm none are missing): ` __________ `

## 3. Supabase — Auth config (not in migrations)
- **Providers**: Google OAuth is used (`signInWithOAuth`). Record the Google **Client
  ID / Client Secret** location (Supabase → Authentication → Providers → Google) and
  the matching Google Cloud OAuth consent-screen project: ` __________ `
- **Redirect URLs / Site URL** (Authentication → URL Configuration): list them
  (production + `staging.apartment-6s4.pages.dev` + localhost): ` __________ `
- **Email templates / SMTP** (magic-link sender): default or custom? ` __________ `

## 4. Supabase — Storage buckets (bucket config not in migrations)
- Bucket `documents` (used by uploads). Record: public/private, size limits, allowed
  MIME types, and its RLS policies if set in the dashboard rather than a migration:
  ` __________ `

## 5. Cloudflare Pages (frontend hosting)
- Project name `apartment`. Record: production branch, the `staging` branch alias
  (`staging.apartment-6s4.pages.dev`), and **build environment variables** set in the
  Pages dashboard (these are what make the deployed build work):
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`,
  `VITE_FEEDBACK_ADMIN_EMAILS`, `VITE_APP_ENV` (staging only). Values live only here:
  ` __________ `
- Custom domain(s), if any: ` __________ `

## 6. GitHub Actions — repo secrets (Settings → Secrets and variables → Actions)
Used by `.github/workflows/*`. Names only:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEEDBACK_ADMIN_EMAILS`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PIPELINE_SECRET`,
  `CLAUDE_CODE_OAUTH_TOKEN`.
- Confirm all present: ` __________ `

## 7. Accounts you must be able to reach from another device
So you can regenerate the machine-local secrets and keep deploying:
- Supabase (project `bjholzkesnzkbogxmurw`) — ` ___ `
- Anthropic console (for `ANTHROPIC_API_KEY`) — ` ___ `
- Cloudflare (Pages `apartment`) — ` ___ `
- GitHub (`tulios123/apartment`) — ✔ (you're pushing from your phone)
