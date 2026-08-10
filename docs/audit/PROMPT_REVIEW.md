# PROMPT_REVIEW.md — Stage 0 calibration of NIGHT_RUN.md against the actual repo

Working doc (English, like NIGHT_RUN.md itself; the morning report is Hebrew). Each item: what the prompt says → what the repo says → what this run does about it. The two boundaries and the deliverables are untouched.

## Factual corrections (applied)

1. **Test credentials.** Prompt: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `.env.local`. Reality: those keys don't exist; the repo's mechanism is `VITE_DEV_BYPASS_AUTH=true` + `VITE_DEV_USER_EMAIL` (`dev@test.local`) + `VITE_DEV_USER_PASSWORD` — auto-login wired into `AuthContext` (src/contexts/AuthContext.tsx:13), gated on `import.meta.env.DEV` so it is compiled out of any production build. **Applied:** the pre-flight gate = start the Vite dev server, open Playwright, assert the authenticated Home renders. The Login screen itself is audited via a second dev-server instance launched with `VITE_DEV_BYPASS_AUTH=false` (shell env overrides `.env.local` in Vite).
2. **Missing baseline docs.** `FAMILY_RELEASE_FIXES.md` does not exist anywhere in the repo; `docs/audit/UX_LIVE_QUEUE.md` does not exist. **Applied:** skipped; the remaining baseline docs (`_audit_reports/*`, `_audit_fixes_log.md`, `QA_MASTER_CHECKLIST.md`, `UX_REVIEW.md`, `DESIGN_REVIEW.md`, `ROADMAP.md`, `docs/reviews/*`) cover the ground.
3. **Onboarding step count.** Prompt says 9 steps — **confirmed** from code: Welcome, Purchase, Mortgage, Loans, Investment, Rental, Insurance, Documents, Done (src/components/onboarding/).
4. **Seed-script auth.** Prompt: "service-role key from local env only". Reality: there is **no service-role key** in `.env.local` (only the anon key + a management-API access token). **Applied (safer than the prompt):** seed/cleanup scripts sign in with the dev test account over the **anon key** — RLS then confines every write/delete to the test account *by construction*, which is strictly stronger than trusting script logic with a service-role key. Both safety flags (`--owner-email`, `--i-know-this-is-shared-supabase`) kept.
5. **Protected admin data-reset — exists.** Settings → manager/dev-only "איפוס כל הנתונים" (src/pages/Settings.tsx:116): deletes rows `owner_id = user.id` across the 11 domain tables + storage files, checks every step, feedback tables untouched. The prompt's preferred sequencing (reset → clean-account onboarding E2E → empty states → seed) is feasible and will be used.
6. **Machine clock is untrustworthy.** Observed ~7h skew earlier this same day (clock 00:44 vs real ~08:00); at run start it reads 2026-07-16 23:53 EEST. **Applied:** no wall-clock claims in findings; timestamps in reports labeled "machine time"; durations measured with monotonic timers where they matter (perf checks).
7. **Branching.** Prompt implies branch-then-merge. Reality: the owner runs parallel sessions sharing this one working tree — `git checkout` is unsafe here. **Applied:** commit directly on `staging`, one finding = one commit (`fix(AUD-###)` / `improve(OBS-###)`); the "merge to staging at every green boundary" requirement is satisfied trivially; nothing ever hangs on a PR. Branch verified before every commit.
8. **Playwright.** Repo had bare `playwright` ^1.60.0 but not `@playwright/test`. Installed `@playwright/test` + webkit/chromium binaries (the single allowed package.json edit). iPhone 16 Pro profile: use `devices['iPhone 16 Pro']` if present in this version, else manual profile (402×874, DPR 3, webkit, touch).
9. **UX_FOUNDATIONS truncation.** Lens F onward is missing (source truncated; noted in the file). Items 1–33 (Lenses A–E) are the measurable instrument for this run; no invented lenses.
10. **Console-monitor noise.** The dev server emits React/Vite dev-only noise (HMR, devtools hints). **Applied:** the monitor counts `console.error`/`console.warn` from app code; known dev-only infra messages are filtered and the filter list is logged in evidence.

## Checks added (repo knowledge the prompt lacked)

- **Version-freshness system** (`UpdateBanner`, `useVersionCheck`, `/version.json` no-store poll): stale-PWA cache is the known #1 family complaint — code-verify the flow end-to-end (Stage 3 service-worker item extends to it).
- **Billing-day feature merged hours ago** (`payment_day` on mortgages/loans, migration 048, commit 21d10b9): fresh code — cross-screen payment-date consistency added to Stage 1 data-correctness checks.
- **Sheet dismiss pattern (settled house rule):** every add/edit bottom-sheet must close-with-discard-confirm when dirty (`shouldConfirmDiscard` + `ConfirmDialog`), never dock-and-stay. Compliance sweep added to Stage 1 riders.
- **Local-date helpers law:** stored/compared dates must use `src/lib/format` helpers, never `toISOString().slice(0,10)` (Israel TZ). Grep enforced in Stage 5.

## Disagreements (logged, proceeding on best judgment)

- **Stage 6(a) "hide ניהול משוב from non-admin users":** code already gates the feedback admin by admin email; will verify actual menu visibility for a non-admin before changing anything rather than blindly re-implementing.
- **"~400 transactions across 14 months" seed volume:** kept, but inserted in batches with tags, and the cleanup script is written and smoke-tested *before* the seed runs (cleanup-first discipline the prompt doesn't require).

## Wasteful steps trimmed

- No screenshot-wholesale viewing (per prompt); layout pass is programmatic, images opened only on flagged violations + one sampled dark shot per screen.
- Baseline construction delegated to a sonnet subagent (quota economics), lead consumes the table only.
