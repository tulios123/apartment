# 01 — Critical Bugs & Broken Flows

> Full-scale functional audit. Prioritized: broken flows, silent failures, security/RLS.
> Each item: **Severity · Location · Symptom · Reproduce · Root cause · Fix.**
> Audit date: 2026-06-26. Scope: entire app (DB → edge → PWA → UI).

Severity legend: **P0** ship-blocker / data-loss / security · **P1** broken flow, user-visible · **P2** silent / conditional.

---

## C1 — Feedback admin RLS vs UI mismatch (admin view returns empty)  · **P1**

- **Location:** `supabase/migrations/027_feedback.sql` (policy `feedback_select_own_or_admin` hardcodes `itai.shubi@gmail.com`) vs `supabase/migrations/031_feedback_admin_dev.sql` (changes it to `dev@test.local`, **NOT yet applied**) vs `src/pages/Settings.tsx` (UI gates the admin reader on `dev@test.local`).
- **Symptom:** Logged in as `dev@test.local`, the Settings "feedback inbox" UI renders (UI gate passes), but the DB RLS `SELECT` policy still only widens for `itai.shubi@gmail.com`. So the query returns **only the dev account's own feedback**, not everyone's — the inbox looks empty/partial and the manager silently misses family feedback.
- **Reproduce:** Sign in as `dev@test.local` → Settings → open feedback list. Have another account submit a note. The note does not appear.
- **Root cause:** Migration 031 is pending (`supabase db push` is owner-gated). Until applied, the JWT-email check in RLS ≠ the UI gate.
- **Fix:** Apply migration 031. Then verify with a 2-account test (writer submits, dev reads). Longer term: stop hardcoding the admin email in RLS — store an `is_admin` flag on `owners` and gate on that, so changing the admin never needs a migration.

---

## C2 — Onboarding has no progress persistence: drop-off = total loss  · **P0 (UX/data)**

- **Location:** `src/components/onboarding/useOnboardingState.ts` — wizard state (`step`, all form fields, `tracks`, `loans`, `purchaseDocFiles`, etc.) is **pure in-memory `useState`**. The only `localStorage` use (lines ~251/306/376/425) caches **AI extraction results keyed by file hash** — it does NOT persist wizard progress. Nothing is written to the DB until the final finish (`uploadOnboardingDocs` + property/contract/tracks/loans inserts).
- **Symptom (this is the "drop off at step 4 and return" question):** Any reload, tab discard (iOS aggressively reclaims PWA tabs), crash, OAuth round-trip back to Safari, or accidental close **mid-onboarding wipes everything** — the user restarts from the Welcome step and re-enters address, price, every mortgage track, every loan. The AI extraction cache survives, but `File` objects can't be persisted, so they must re-pick files anyway.
- **Reproduce:** Start onboarding, fill purchase + add 2 mortgage tracks, reach the loans step, pull-to-refresh (or background the PWA on iOS for a while) → reopen → back at Welcome, all data gone.
- **Root cause:** No serialization of wizard state; no incremental server persistence.
- **Fix:** Persist a JSON snapshot of the serializable wizard state (everything except `File` objects) to `localStorage` on change (debounced), keyed by `user.id`; rehydrate on mount and offer "continue where you left off". Files remain re-pick-only (acceptable — extraction cache makes re-extract free). Clear the snapshot on successful finish.

---

## C3 — Cold-start network blip routes an existing user into Onboarding (→ duplicate property)  · **P0**

- **Location:** `src/App.tsx` lines 30-38.
  ```ts
  supabase.from('properties').select('id').eq('owner_id', user.id).limit(1)
    .then(({ data }) => setHasProperty((data?.length ?? 0) > 0))
  ```
- **Symptom:** The query result is consumed **without checking `error`**. On a transient failure (flaky cellular cold start, expired token mid-refresh, Supabase 5xx) `data` is `undefined` → `hasProperty = false` → the app renders **Onboarding to a user who already has a property**. If they proceed, finishing onboarding **inserts a second `properties` row** (and a second contract/tracks/loans set), permanently corrupting their data.
- **Reproduce:** Throttle/drop the network at app launch (DevTools offline during the initial `properties` query) for an existing user → Onboarding appears instead of Home.
- **Root cause:** `error` is ignored; failure is indistinguishable from "no property". No `.catch`, no retry.
- **Fix:** Treat an errored property check as **unknown, not false** — keep `hasProperty = null` (stay on Splash) and retry with backoff, or surface a retry screen. Never fall through to Onboarding on a query error. Belt-and-suspenders: make the onboarding-finish property insert idempotent (don't create a 2nd property if one already exists for the owner).

---

## C4 — No React error boundary anywhere: any render exception white-screens the whole app  · **P0**

- **Location:** entire `src/` (grep for `ErrorBoundary` / `componentDidCatch` → **none**). `App.tsx` only handles a stats-fetch error string in `HomeScreen` (`if (error) return <PageError>`); it does not catch thrown exceptions during render.
- **Symptom:** One malformed record or an unexpected `undefined` access in any screen's render (e.g. a task with a null field a component dereferences, a NaN in a chart, a bad date) throws and **unmounts the entire React tree → blank white screen** with no recovery, no message, on the installed PWA where there's no visible URL bar to "reload".
- **Reproduce:** Inject a record that violates a component's assumption (e.g. a transaction with `amount: null`, or a contract missing `end_date`) and open the screen that renders it.
- **Root cause:** No top-level (or per-route) error boundary.
- **Fix:** Add a top-level `ErrorBoundary` wrapping `<AppRoutes/>` (and ideally a lighter one per route inside `Layout`'s `<Outlet/>`) that renders a friendly Hebrew fallback + "רענון" button and logs the error. This is the single highest-leverage reliability fix.

---

## C5 — Offline / failed task completion: task bounces back **but the money-follow-up dialog still fires**  · **P1**

- **Location:** `src/pages/dashboard/HomeScreen.tsx` `markTaskDone` lines 197-218 (same pattern in `src/pages/tasks/TasksV2.tsx:132`).
- **Symptom:** `markTaskDone` optimistically removes the task, then `updateTask(...).then` restores it via `refetchTasks()` **if the write failed**. But the money follow-up (lines 212-217) runs **synchronously, not gated on the write succeeding** — so when offline (or the write fails) the user: (a) sees the task vanish, (b) gets a native `confirm()` asking to record the expense, (c) on "OK" is navigated to `/finances` with a prefill, (d) the task then **reappears** (write failed) plus a "לא הצלחנו לעדכן" flash. Net: navigated away to log money for a task that never completed.
- **"5 tasks completed offline":** five optimistic removals → five failed writes → five `refetchTasks()` racing (last wins, all 5 reappear) → up to five stacked `confirm()` dialogs → five "couldn't update" flashes. Confusing and non-functional.
- **Reproduce:** Go offline, tap "סיים" on a task that has a follow-up (rent/repair/payment category).
- **Root cause:** Follow-up is not chained to the persisted result; optimistic UI assumes success.
- **Fix:** Move the follow-up into the `.then` success branch (only after `!r.error`). Replace `confirm()` with an in-app non-blocking prompt (see UX-03). Debounce/serialize rapid completions; reconcile with a single refetch.

---

## C6 — Daily push lists the same item twice (approval-item line **and** its generated task)  · **P1**

- **Location:** `supabase/functions/daily-reminders/index.ts` — section 1 (lines 86-115, approval items not yet recorded) and section 3 (lines 157-165, open tasks due/overdue), cross-referenced with `src/hooks/useMonthlyGeneration.ts` lines 104-123 (which creates an approval **task** titled `תשלום <category>` for non-rent `requires_approval` items).
- **Symptom:** For a non-rent approval item, the client generator creates a task `"תשלום ארנונה"` (open, due this month). The same item is also unrecorded → the edge function's **section 1** pushes the line `"תשלום ארנונה"`, **and section 3** pushes the generated task's title `"תשלום ארנונה"`. The notification body lists the identical line **twice**. Renewals can double similarly (section 2a renewal line + a `source='renewal'` task picked up by section 3).
- **Reproduce:** Have a non-rent `requires_approval` recurring item whose `day_of_month` has passed and isn't recorded; open the app once this month (so the generator creates the task); trigger the daily function.
- **Root cause:** Two independent "what's due" pipelines (client generator vs server detector) overlap without de-duplication.
- **Fix:** De-dupe the assembled `lines[]` before composing the body (e.g. `[...new Set(lines)]`), or have section 3 exclude tasks whose `recurring_item_id` already produced a section-1 line. Also un-throttled daily nagging — see EDGE-09.

---

## C7 — Silent failures: receipt attach & rent income can vanish with no signal  · **P2**

- **Location A — receipt:** `src/components/capture/ExpenseSheet.tsx` lines 151-163. The receipt upload + `documents` insert + `transactions.update(document_id)` is wrapped in `try {} catch { /* swallow */ }`. If `supabase.auth.getUser()` returns no user, or the upload/RLS fails, the receipt is **silently dropped** while the expense shows "נשמר ✓" — the user believes the receipt is attached.
- **Location B — dashboard rent:** `src/hooks/useDashboardStats.ts` — only `txRes/tasksRes/renewalRes` errors are thrown (lines 81-83). `allContractsRes.error` and `tracksRes.error` are **not surfaced**; on error they fall back to `[]`, so `rentReceivedToDate([])` = 0 and `mortgagePaidToDate([])` = 0. A contracts/tracks query failure **silently zeroes rent income / mortgage expense** on the home totals with no error shown.
- **Reproduce A:** Attach a receipt while signed out of the local session / with storage RLS denying → expense saves, receipt silently missing.
- **Reproduce B:** Make the `contracts`/`mortgage_tracks` select error → home shows ₪0 rent with no error banner.
- **Fix:** A — surface a non-fatal "הקבלה לא צורפה, נסו שוב" toast on receipt failure (the expense still saved). B — track partial-failure of the secondary queries and show a soft "חלק מהנתונים לא נטענו" indicator instead of silently computing on empty arrays.

---

## C8 — Home forecast can double-count loan / owner-utility payments  · **P2 (conditional, financial)**

- **Location:** `src/pages/dashboard/HomeScreen.tsx` lines 77, 90, 96.
  ```ts
  const fixedCatSet = new Set([...MORTGAGE_CATEGORIES, 'ביטוח'])      // excludes ONLY mortgage + insurance
  const fixedExpenses = selectedMortgage + monthlyLoan + monthlyInsurance + monthlyOwnerUtilities  // projected
  const extraTxs = transactions.filter(t => t.direction==='expense' && !fixedCatSet.has(t.category)) // actual
  ```
- **Symptom:** `fixedExpenses` includes **projected** loan and owner-utility amounts, but `fixedCatSet` only excludes mortgage + insurance categories from the **actual** `extraTxs`. So if a loan payment (category `'הלוואה'`, see `projections.ts:138`) or an owner-paid utility is ever recorded as a real transaction, it is counted **both** in `fixedExpenses` (projection) **and** `extraExpenses` (actual) → the "צפי לסוף החודש" is understated by that amount, double-charged.
- **Reproduce:** Record a manual expense categorized `'הלוואה'` (or the utility category) this month → the end-of-month forecast drops by twice the amount.
- **Root cause:** The exclusion set is narrower than the projected set.
- **Fix:** Either add loan + owner-utility categories to `fixedCatSet`, or — cleaner — drive "fixed" purely from projections and never let those categories be hand-recorded, or reconcile actual-vs-projected per category. Confirm whether loan/utility lines are ever posted as transactions (today they appear virtual-only via `monthlyVirtualEntries`, which keeps it latent — but a manual entry triggers it).

---

## SECURITY — historical anon hole (RESOLVED) + ongoing notes

- **`anon_all` full-access policies** (`002_rls_policies.sql`) granted the **public anon key** full read/write on every table; storage had open `anon_*` policies (`003`). `026_drop_anon_policies.sql` **drops them**; `006` provides the per-user `owner_scoped` policies. **Status: resolved IF 026 is applied in prod** (QA notes record "live anon = 0 verified"). **Action: confirm 026 is applied on the live DB** — if a restore/branch ever skipped it, every family member's data is world-readable with the public key.
- **`push_log` / `reminder_log`:** RLS enabled, **no client policy** → authenticated denied, service-role-only. Correct.
- **Feedback PII:** `feedback` stores `email`, `user_agent`, free-text `note` in plaintext; admin reads all. Acceptable for a family app; note that notes may contain sensitive text.
- **Edge function auth:** `daily-reminders` gates on `x-cron-secret` header equality with `CRON_SECRET`. Fine. CORS `*` is harmless given the secret gate.
- **`DEV_BYPASS`** is compiled out of prod (`import.meta.env.DEV` guard) — verified safe.

---

### Critical-bug fix order (see 04_ACTION_PLAN.md for detail)
1. **C4** error boundary (cheap, huge blast-radius reduction)
2. **C3** hasProperty error handling (prevents duplicate-property corruption)
3. **C2** onboarding persistence (biggest UX loss)
4. **C1** apply migration 031 (one command)
5. **C5/C6/C7/C8** (flow correctness & silent failures)
