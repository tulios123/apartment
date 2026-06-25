# 04 — Action Plan (fix roadmap)

> Technical, ordered roadmap to clear the findings in `01`–`03`. Grouped by wave.
> Each item: **what · where · acceptance check · rough effort.**
> Audit date: 2026-06-26.

---

## Executive summary

The app's **happy paths are solid** and the date discipline, RLS scoping, SWR caching, and amortization math are genuinely well-built. The risk concentrates in **resilience and edge handling**, not core features:

1. **No error boundary** → any bad record white-screens the whole PWA. (C4)
2. **Cold-start property check ignores errors** → a network blip can route an existing user into onboarding and create a **duplicate property**. (C3)
3. **Onboarding keeps zero progress** → any interruption mid-wizard loses everything. (C2)
4. **Feedback admin RLS ≠ UI** until migration 031 is applied → manager's inbox silently empty. (C1)
5. A cluster of **silent failures, duplicate push lines, offline-completion bounce-back, and timezone off-by-ones**. (C5–C8, EDGE-01..04)

Fixing waves 1–2 below removes essentially all the data-corruption and white-screen risk and is ~1 focused day.

---

## WAVE 1 — Resilience (do first; prevents corruption & white-screens)

- [ ] **A1 · Top-level error boundary** *(C4)* — add `src/components/ErrorBoundary.tsx` (class component with `getDerivedStateFromError`/`componentDidCatch`), wrap `<AppRoutes/>` in `App.tsx`, and add a lighter one around `Layout`'s `<Outlet/>`. Fallback: Hebrew "משהו השתבש" + "רענון" button; `console.error` the stack.
  *Accept:* throwing inside a screen shows the fallback, not a blank page. **Effort: S.**

- [ ] **A2 · Harden the `hasProperty` check** *(C3)* — in `App.tsx`, destructure `{ data, error }`; on `error` keep `hasProperty = null` (stay on Splash) and retry (2–3× backoff) instead of falling to Onboarding. Add a final "couldn't load — retry" state behind the 5s ceiling.
  *Accept:* offline at cold start for an existing user never shows Onboarding. **Effort: S.**

- [ ] **A3 · Idempotent onboarding finish** *(C3 belt-and-suspenders)* — before inserting a property on finish, check the owner has none; reuse if present.
  *Accept:* finishing onboarding twice can't create two properties. **Effort: S.**

- [ ] **A4 · Apply migration 031** *(C1)* — owner runs:
  ```
  cd /Users/itaishubi/ai/Apartment && npx supabase db push
  ```
  Then 2-account test: writer submits feedback, `dev@test.local` sees it. **Effort: trivial (owner-gated).**

- [ ] **A5 · Confirm `026_drop_anon_policies` is live** *(Security)* — verify no `anon_all`/`anon_*` policies exist on the prod DB (anon key returns 0 rows on every table). **Effort: trivial (verification).**

## WAVE 2 — Onboarding persistence (biggest UX loss)

- [ ] **B1 · Persist wizard progress** *(C2)* — in `useOnboardingState`, serialize the non-`File` state to `localStorage` (debounced), keyed `onboarding:<user.id>`; rehydrate on mount; clear on successful finish. Files stay re-pick-only (extraction cache already makes re-extract free).
  *Accept:* reload mid-wizard → returns to the same step with fields intact; a "המשך מהמקום שעצרת" path. **Effort: M.**

- [ ] **B2 · Re-pick affordance** *(UX-17)* — remember uploaded file *names* across reload and show "כבר נקרא — בחרו שוב את הקובץ אם תרצו" so resuming feels continuous. **Effort: S.**

## WAVE 3 — Flow correctness & silent failures

- [ ] **C-fix5 · Gate the money follow-up on write success** *(C5)* — move the `taskCompletionFollowup` block into the `updateTask().then` success branch in both `HomeScreen.tsx` and `TasksV2.tsx`; serialize rapid completions; single reconciling refetch.
  *Accept:* completing a task offline does **not** open the follow-up and the task cleanly reappears once. **Effort: S.**

- [ ] **C-fix6 · De-dupe daily push lines** *(C6, EDGE-09)* — in `daily-reminders/index.ts`, dedupe `lines` (`[...new Set(lines)]`) and/or exclude section-3 tasks whose `recurring_item_id` already produced a section-1 line; consider a cadence cap on section-1 nagging.
  *Accept:* an unrecorded approval item appears once per notification. **Effort: S** (owner redeploys the function).

- [ ] **C-fix7 · Surface silent failures** *(C7)* — ExpenseSheet: on receipt-attach failure show "ההוצאה נשמרה, אך הקבלה לא צורפה". Dashboard: track partial failure of the secondary contracts/tracks queries and show a soft indicator instead of computing on `[]`. **Effort: S.**

- [ ] **C-fix8 · Resolve fixed-vs-actual double counting** *(C8)* — confirm whether loan/owner-utility payments can be hand-recorded; if yes, add their categories to `fixedCatSet` (or drive "fixed" purely from projections). **Effort: S** (after confirming the data path).

## WAVE 4 — Date/timezone consolidation

- [ ] **D1 · One date helper everywhere** *(EDGE-01..04)* — replace the three UTC-parsing `daysLeft`/month-diff sites (`useMonthlyGeneration:142`, `useDashboardStats:101`, `projections.ts:8/46`) with string-based diffs (mirror the edge function's `daysBetween`). Fix `format.ts:formatDate` to format from parts / `T00:00:00`.
  *Accept:* a unit test pinned to 23:30 Asia/Jerusalem yields identical `daysLeft` on client and server. **Effort: M** (touches several call sites; covered by existing `__tests__`).

## WAVE 5 — Push robustness

- [ ] **E1 · `pushsubscriptionchange`** *(EDGE-11)* — add an SW handler that re-subscribes and re-upserts; on app open, if permission granted but `getSubscription()` is null, silently re-`enablePush`. **Effort: M.**

- [ ] **E2 · Reliable notification routing** *(EDGE-08)* — add the SW `message` listener at the app root (not only authed `Layout`); have the SW pass the target as `?notif=<url>` on `openWindow`/focus so a cold or non-app-screen open still lands correctly. **Effort: M.**

## WAVE 6 — Data robustness & polish

- [ ] **F1 · Coerce numeric fields at hook boundaries** *(EDGE-23, EDGE-14)* — `Number(x) || 0` for `amount`/`monthly_rent`/rates as they enter the app; compare money with a cent epsilon (or integer agorot). **Effort: S.**
- [ ] **F2 · Validate `grace_months < term_months`** *(EDGE-12)* in `TrackForm`/`LoanForm`. **Effort: S.**
- [ ] **F3 · Replace native `confirm()`/`alert()`** *(UX-03/04)* with in-app prompts/toasts. **Effort: M.**
- [ ] **F4 · Offline banner** *(UX-07)* via `navigator.onLine` + events. **Effort: S.**
- [ ] **F5 · Discard-guard on scrim/Esc** *(UX-02)* — when a sheet holds data, dock/confirm instead of closing. **Effort: S.**
- [ ] **F6 · `ExpenseSheet` step-2** *(UX-01)* — verify `.bsheet-body` scrolls under the keyboard inset; consider not auto-focusing the description. **Effort: S** (verify) **/ M** (rework).
- [ ] **F7 · Env guard** *(EDGE-26)* in `supabase.ts` with a readable message. **Effort: trivial.**
- [ ] **F8 · Focus trap/restore** *(UX-05)* in `BottomSheet`/`Modal`. **Effort: M.**

---

## Suggested two-session plan

**Session 1 (resilience, ~half day):** A1, A2, A3, A4, A5, C-fix5, F7. → removes white-screen + duplicate-property + offline-completion risk and unblocks the feedback inbox.

**Session 2 (persistence + correctness, ~full day):** B1, B2, C-fix6, C-fix7, C-fix8, D1. → onboarding survives interruption, push stops duplicating, dates agree client/server, silent failures surface.

Then Waves 5–6 as polish.

---

## Verification assets already present

- `src/lib/__tests__/` covers `equity`, `format`, `loans`, `mortgage`, `projections`, `quickParse`, `taskFollowup` — extend these for D1 (timezone) and EDGE-12 (grace≥term). Run `npm test` before/after each wave.
- The SWR cache + the `_headers` policy mean deploys propagate the shell immediately; remember the PWA still needs a refresh to pick up a new build (stale-PWA gotcha).

## Notes / non-issues confirmed during the audit (don't "fix")
- `monthEndISO` is correct (clever 1-indexed-month trick) — leave it.
- `DEV_BYPASS` is compiled out of prod — safe.
- Amortization (Shpitzer, grace, rounding-drift absorption) is correct for valid inputs.
- `getOwnerId()` reading the local session (not `getUser()`) is an intentional, correct latency optimization.
- `push_log`/`reminder_log` service-role-only RLS is correct.
