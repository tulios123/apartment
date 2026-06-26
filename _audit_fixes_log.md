# Audit Fixes — Implementation Log

> Sequential fix pass over `_audit_reports/` (01_CRITICAL_BUGS → 02_EDGE_CASES → 03_UX_FRICTION).
> Each entry: **issue · file(s) changed · fix applied.** Owner-gated items (DB push / function
> redeploy) are flagged at the bottom — they can't be applied from here.
> Started: 2026-06-26.

---

## WAVE 1 — Resilience

- **C4 · No error boundary → white-screen.**
  - New `src/components/ErrorBoundary.tsx` — class boundary (`getDerivedStateFromError` + `componentDidCatch`), Hebrew "משהו השתבש" fallback + "רענון" (reload) button; `screen` and lighter `inline` variants; logs the stack via `console.error`.
  - `src/App.tsx` — wrapped `<AppRoutes/>` in a top-level `<ErrorBoundary boundary="root">`.
  - `src/components/layout/Layout.tsx` — wrapped `<Outlet/>` in an `inline` boundary keyed on `pathname`, so a crash in one screen keeps the shell + nav and resets on navigation.
  - `src/index.css` — `.error-boundary` / `--inline` / card / title / text / button styles using the existing design tokens.

- **C3 · Cold-start property check ignores error → routes existing user to Onboarding → duplicate property.**
  - `src/App.tsx` — the `properties` check now destructures `{ data, error }`. On `error` it keeps `hasProperty = null` (stays on Splash) and retries with capped exponential backoff (1→2→4→8s); after 4 failures it shows a manual "לא הצלחנו לטעון / נסו שוב" retry screen instead of ever falling through to Onboarding. Retry button bumps a `retryNonce` that re-runs the effect.

- **C3 / A3 · Idempotent onboarding finish (belt-and-suspenders).**
  - `src/components/onboarding/useOnboardingState.ts` `handleFinish` — before inserting, queries the owner's existing `properties`; if one exists it is reused instead of creating a second. Normal new-user path (empty result or query error) still creates exactly one.

- **EDGE-26 / F7 · Missing env at build → cryptic crash.**
  - `src/lib/supabase.ts` — throws a readable error naming `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` if either is absent, instead of constructing a broken client.

## WAVE 2 — Onboarding persistence

- **C2 · Onboarding kept zero progress → any interruption wiped everything.**
  - New `src/lib/onboardingDraft.ts` — `load/save/clearOnboardingDraft`, versioned, per-user key (`onboarding_draft:<id>`), best-effort (swallows quota/private-mode errors).
  - `src/components/onboarding/useOnboardingState.ts` — all serializable wizard fields (step + purchase + tracks + investment + rental + insurance + loans state) now lazy-init from the saved draft; a debounced (400ms) effect re-persists on change (skipping `welcome`/`done`); the draft is cleared on successful finish. Files stay re-pick-only (the extraction cache makes re-reading free), so AI extraction is untouched. A reload mid-wizard now returns to the same step with fields intact.

## WAVE 3 — Flow correctness & silent failures

- **C5 · Offline/failed task completion still fired the money follow-up (+ native confirm()).**
  - New `src/components/ui/ConfirmDialog.tsx` + `.confirm-*` styles in `src/index.css` — an in-app, themed, RTL, non-blocking dialog replacing the native `confirm()` (also UX-03).
  - `src/pages/dashboard/HomeScreen.tsx` `markTaskDone` and `src/pages/tasks/TasksV2.tsx` `toggleDone` — the follow-up now fires **only inside the `updateTask().then` success branch** (`!r.error`), via `setFollowup(...)` → `<ConfirmDialog>`. An offline/failed completion bounces the task back and prompts nothing.

- **C6 · Daily push listed the same item twice (approval line + its generated task; renewals too).**
  - `supabase/functions/daily-reminders/index.ts` — section 1 records the recurring-item IDs it emitted; section 3 now selects `source, recurring_item_id` and skips `source='renewal'` tasks (handled live by section 2a) and tasks whose recurring item already produced a section-1 line; the assembled `lines` are de-duped (`[...new Set]`) before composing the body. **(Owner must redeploy the function.)**

- **EDGE-09 · Un-throttled daily approval nagging.** The harmful part (a *doubled* line every day) is removed by the C6 de-dup. The daily cadence itself is left intentional — money approvals should keep reminding until recorded; a cadence cap was deliberately not added so a real unpaid item is never silently suppressed.

- **C7 · Silent failures (receipt attach & dashboard rent/mortgage).**
  - `src/components/capture/ExpenseSheet.tsx` — receipt-attach failure now flips a `receiptFailed` flag and reports "ההוצאה נשמרה, אך הקבלה לא צורפה — נסו שוב מהמסך" via `onDone`, instead of swallowing it while showing "נשמר ✓".
  - `src/hooks/useDashboardStats.ts` — exposes a `partial` flag set when `allContractsRes.error || tracksRes.error`; `src/pages/dashboard/HomeScreen.tsx` renders a soft "חלק מהנתונים לא נטענו" note (`.data-partial-note`) instead of silently showing ₪0 rent/mortgage computed on empty arrays.

- **C8 · Forecast could double-count loan / owner-utility payments.**
  - `src/pages/dashboard/HomeScreen.tsx` — `fixedCatSet` now mirrors every component of `fixedExpenses`: `[...MORTGAGE_CATEGORIES, 'ביטוח', 'הלוואה', ...UTILITIES]`, so a hand-recorded loan/utility transaction is no longer added on top of its projected amount.

## WAVE 4 — Date / timezone consolidation

- **EDGE-01/02/04 · UTC-parsing date math diverged from the server.**
  - `src/lib/format.ts` — new `daysBetween(fromISO, toISO)` (string-based, UTC-midnight anchored, mirrors the edge function) and `parseLocalISO(iso)`; `formatDate` now builds a LOCAL date from the parts so a viewer behind UTC no longer sees stored dates a day early (EDGE-04).
  - `src/hooks/useMonthlyGeneration.ts` (renewal `daysLeft`) and `src/hooks/useDashboardStats.ts` (upcoming-renewal `daysLeft`) now use `daysBetween(todayStr, end_date)` — client and server agree on "days left".
- **EDGE-03 · projections parsed dates as UTC, inconsistent with loans/mortgage.**
  - `src/lib/projections.ts` — `elapsedMonths` and `rentReceivedToDate` now parse via `parseLocalISO` (LOCAL), matching `mortgage.ts`/`loans.ts`.
- **UX-14 · Stale "נותרו X ימים" in the renewal task.**
  - `src/hooks/useMonthlyGeneration.ts` — the renewal task title is now `חידוש חוזה עם <company>` with no baked-in day count (the live count still shows on the home renewal card).

## WAVE 5 — Push robustness

- **EDGE-08 · Notification tap dropped when no Router was mounted (Login/Onboarding/cold).**
  - New `src/lib/notifNav.ts` — buffers the SW "navigate" target and replays it once a Router-bound consumer subscribes.
  - `src/App.tsx` — the SW `message` listener now lives at the app root (always mounted) and feeds `pushNotifTarget`.
  - `src/components/layout/Layout.tsx` — consumes targets via `subscribeNotifTarget(navigate)` (replays any buffered tap after login).
- **EDGE-11 · No re-subscribe on endpoint rotation → pushes silently stop.**
  - `src/lib/push.ts` — new `ensurePushFresh(ownerId)`; `Layout` calls it on open: if permission is granted but there's no live subscription, it transparently re-subscribes + re-upserts.

## WAVE 6 — Data robustness, financial degeneracies & polish

- **EDGE-12 · grace ≥ term → never-amortizing schedule.** `src/lib/mortgage.ts` (`monthlyPayment`, `trackSchedule`, `gracePeriodPayment`) and `src/lib/loans.ts` (`loanSchedule`) clamp grace to `term-1` (always ≥1 amortizing month).
- **EDGE-13 · Net-negative rate.** Same files floor the effective rate at 0 so the math never goes odd/negative.
- **EDGE-14 · Float money comparison.** `HomeScreen` "rent cleared" compares with a half-shekel epsilon. Plus EDGE-23 coercion below removes most drift sources.
- **EDGE-23 · null/NaN amounts poisoning totals.** `src/hooks/useTransactions.ts` and `src/hooks/useDashboardStats.ts` coerce `amount` to a finite number at the hook boundary (`Number(x) || 0`).
- **EDGE-17 · No upload size ceiling.** `src/lib/storage.ts` — `MAX_UPLOAD_BYTES` (15MB) guard in `uploadDocument`/`uploadReceipt`; `ExpenseSheet` rejects oversized receipts up front with a clear message.
- **EDGE-18 · Extensionless files.** `src/lib/storage.ts` — `fileExt()` falls back to `bin` when the name has no dot.
- **EDGE-19 · quickParse misclassification.** `src/lib/quickParse.ts` — dropped ambiguous הפקד/החזר/זיכוי from `INCOME_RE`; `HomeScreen` quick-add now classifies expenses via `predictCategory` instead of always `'אחר'`.
- **EDGE-16 · Backspace long-press could swallow the next backspace.** `ExpenseSheet` resets `backCleared` at the start of each press sequence.
- **EDGE-07 · Monthly-generation cross-device race (duplicate rows).** New migration `032_generation_idempotency.sql` (unique indexes on `(owner_id, recurring_item_id, date)` and `(…, due_date)`; NULLs distinct so manual rows are unaffected); `useMonthlyGeneration` upserts with `ignoreDuplicates`, falling back to plain insert if the index isn't present yet (no broken window pre-migration). **(Owner must apply the migration.)**
- **UX-01 · Expense step-2 keyboard trap.** `ExpenseSheet` no longer auto-focuses the description (the chips/save stay reachable; matches the owner's stated dislike of an auto-opening keyboard).
- **UX-02 · Scrim/Esc discarded typed data.** `BottomSheet` routes scrim-tap/Esc through the dock path when `minimizable` (data present) instead of closing outright.
- **UX-03 · Native confirm() for the money follow-up.** Replaced by `ConfirmDialog` (Wave 3).
- **UX-04 · Native alert() in Settings.** `src/pages/Settings.tsx` — all six `alert()` calls replaced by an inline auto-dismissing `.settings-toast`.
- **UX-05 · No focus trap/restore.** `BottomSheet` traps Tab + restores focus on close; `Modal` gains `role="dialog"`/`aria-modal`, Esc-to-close, and focus restore.
- **UX-07 · No offline messaging.** New `src/components/OfflineBanner.tsx` mounted at the app root (`navigator.onLine` + online/offline events).

## Infra steps — DONE (executed this session)

- **C1 / A4 · migrations 031 + 032 applied.** `supabase migration list` showed Local == Remote for 001–032; `supabase db push` → "Remote database is up to date." Feedback admin RLS (031) and generation-idempotency indexes (032) are live.
- **C6 · daily-reminders redeployed.** `supabase functions deploy daily-reminders --no-verify-jwt` → "Deployed Functions on project …: daily-reminders." The push de-dup is now in effect.
- **A5 / SECURITY · 026 verified live.** Anon-key REST queries against `properties`, `transactions`, `contracts`, `feedback` all return `[]` — RLS blocks anonymous access; data is not world-readable.

## Documented non-issues / intentionally deferred (no code change)

- **EDGE-05** rent +1-on-day-1 is an intentional forward projection. **EDGE-06** month-rollover-while-open is cosmetic (resolves on remount). **EDGE-09** daily approval cadence is intentional (money actions); the doubled line is fixed via C6. **EDGE-10** push_log release race is acceptable (worst case: one extra same-day notification). **EDGE-15** combineSchedules cost is fine at family scale. **EDGE-24/25** auth-edge cases are low-likelihood and left untouched to avoid destabilizing the warm-session path. **UX-06/18** are on-device verification items. **UX-08/16** silent-failure surfacing is substantially covered by C7. **UX-09/10/11/12/13/15** are perf/scale/cosmetic notes, not bugs at family scale. **UX-17** resume is now implemented (C2); a "this file was already read" badge is deferred as low-value polish.

## Verification

- `npx tsc --noEmit` — clean. `npm test` — 72/72 pass (two prior tests updated to assert the new EDGE-12/EDGE-19 behavior). `npm run build` — succeeds.
