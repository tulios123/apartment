# QA Master Checklist — Apartment

The single end-to-end audit list for the whole app: every feature, every edge case, the
database, the interfaces, all CRUD/edits, the calculation core, code quality, bugs, and
security. Built to be worked through **one chapter at a time**, autonomously.

## How we work this list
- Each session: pick a chapter, execute its checks, then mark each item and **fix every
  bug found** (commit + push), logging the finding inline.
- Status markers per item:
  - `[ ]` not yet checked
  - `[x]` checked — passes / correct
  - `[!]` **bug found → FIXED** (note the commit)
  - `[~]` issue found, **needs owner decision** (not auto-fixed)
  - `[-]` N/A / intentionally skipped (note why)
- Findings get a short note on the line below, indented.
- Keep the **Progress tracker** at the top current.

## Verification tools available
- **Vitest** (to be set up in Ch.1) for the pure logic — objective pass/fail.
- **Preview** (dev server) for UI/flows — but dev auto-logs-in `dev@test.local` (has data);
  empty/new-user states are reviewed by reading code.
- **Supabase Management/REST API** (read-only, via curl + token in `.env.local`) for DB/RLS
  checks — never billed AI calls; never destructive on the linked remote.
- **`npm run build`** for type + bundle validation.
- Never trigger billed AI extractions; use the calibration harness for extraction logic.

---

## Progress tracker
| Ch | Area | Items | Done | Bugs found/fixed | Status |
|----|------|-------|------|------------------|--------|
| 1  | Financial calculation core | ~40 | **72 tests** | **9 bugs fixed** | nominal model fully tested; **CPI-indexation + prepayment NOT modelled (🟡 owner decision)** |
| 2  | Database & data integrity | — | — | — | not started |
| 3  | Security & access isolation | — | partial | XSS ✅ safe · storage-orphan ✅ audited | RLS/anon live-check still TODO |
| 4  | Auth & Login | — | — | — | not started |
| 5  | Onboarding | — | — | — | not started |
| 6  | App entry / routing / splash | — | — | — | not started |
| 7  | Home / Dashboard | — | — | — | not started |
| 8  | Ledger (תזרים) | — | — | — | not started |
| 9  | Wealth (הון) | — | — | — | not started |
| 10 | Property Admin | — | — | — | not started |
| 11 | Settings | — | — | — | not started |
| 12 | Recurring / monthly generation / reminders | — | code-read | **1 bug (#9 🔴) fixed** + 1 🟡 logged | core generation audited; renewal-dup left for owner |
| 13 | Cross-cutting UI (states/RTL/responsive/dark/format) | — | — | — | not started |
| 14 | PWA (manifest/SW/push/offline/install) | — | — | — | not started |
| 15 | Code quality / error handling / edge cases | — | — | — | not started |

---

# Chapter 1 — Financial calculation core (HIGHEST PRIORITY)
*The math that moves real money, currently with zero test coverage. Set up Vitest, write
thorough tests for each function, and fix every bug a failing test reveals.*

### 1.0 Test harness
- [ ] Add Vitest + `npm test` script; one smoke test green.
- [ ] Decide on test file layout (`src/lib/__tests__/*.test.ts`).

### 1.1 `lib/mortgage.ts` — amortization, payment, balance, grace
- [ ] Standard fixed-rate monthly payment matches a known amortization (principal, rate, term).
- [ ] Remaining balance after N months is correct (annuity formula).
- [ ] Total interest over the loan life is correct.
- [ ] Grace period: `gracePeriodPayment(tracks)` — interest-only during grace, no principal.
- [ ] Grace months reduce principal-paid correctly after grace ends.
- [ ] Prime + margin → effective rate composition (uses nominal, not adjusted).
- [ ] 0% rate / 0 term / 0 principal → no NaN/Infinity, sane fallback.
- [ ] Multi-track blended rate + combined monthly payment is the sum of tracks.
- [ ] Negative/empty inputs handled (no crash).
- [ ] "נפרעו %" (paid-off %) is correct for early vs late in the term.

### 1.2 `lib/loans.ts` — monthly loans + balloon
- [ ] Monthly loan payment + balance mirror the mortgage annuity math.
- [ ] Balloon loan: no monthly payment, principal due at end / on sale; not counted in monthly.
- [ ] `summary.monthlyPayment` / `monthlyBalance` / `balloonOutstanding` aggregate correctly.
- [ ] Loan grace months handled.
- [ ] Mixed monthly + balloon loans separated correctly.
- [ ] Annual rate vs monthly rate conversion is correct.

### 1.3 `lib/equity.ts` — ownership split & equity buildup
- [ ] `currentSplit(tracks, monthlyLoans)` — principal vs interest portion of this month's payment.
- [ ] `futureSplit(..., 60)` — principal built over next 60 months.
- [ ] `principalNext12Months` — annual principal reduction.
- [ ] Ownership % = equity / property value; bounded 0–100.
- [ ] Equity = value − (mortgage balance + loans + balloon); never negative-display surprise.
- [ ] Family financing (balloon) shown as a separate segment, not bank debt.

### 1.4 `lib/projections.ts` — virtual/forecast entries
- [ ] `monthlyVirtualEntries` generates rent (income) + mortgage/loan (expense) for a month.
- [ ] A forecast is suppressed when a real transaction of that category exists that month (dedup).
- [ ] `activeContract(contracts)` picks the contract active on a given date (start ≤ today ≤ end).
- [ ] Forecast respects contract start/end and mortgage/loan term boundaries.
- [ ] Month before purchase / after loan end → no spurious forecasts.
- [ ] Owner-paid utilities included in fixed expenses; tenant-paid excluded.

### 1.5 `lib/format.ts` — currency, dates, signed currency
- [ ] `formatCurrency` / `formatSignedCurrency` — sign placement, no sign for zero, RTL marks.
- [ ] `todayISO` / `monthDayISO` / `monthEndISO` — LOCAL dates, no UTC roll-back (Israel UTC+2/+3).
- [ ] `monthEndISO` returns the true last day (28/29/30/31; leap Feb).
- [ ] Date around midnight / DST boundary does not slip a day.

### 1.6 `lib/quickParse.ts` — free-text capture
- [ ] Amount parsed from "שילמתי 350 על תיקון ברז" with correct description.
- [ ] "שח"/"₪"/"שקל" recognized as currency only as standalone tokens (not inside words).
- [ ] Income vs expense detection (received vs paid verbs).
- [ ] Leading connectors ("על", "עבור") stripped from the description correctly.
- [ ] No amount → returns null (caller opens the sheet).
- [ ] Thousands separators / decimals parsed.

### 1.7 `lib/taskFollowup.ts` — task→transaction offer
- [ ] Completing a repair task offers an expense prefill; rent task offers income.
- [ ] Check-deposit rent task → treated as rent income.
- [ ] Non-money tasks → no follow-up.

### 1.8 Cross-calculation reconciliation
- [ ] Monthly net is consistent between Home cash-flow and Ledger balance for the same month.
- [ ] Equity on Wealth hero == value − debts (matches the Done screen's derived equity).
- [ ] Gross yield (monthly rent × 12 / value) consistent wherever shown.
- [ ] `fixedExpenses` (Home) == mortgage + loans + insurance + owner-utilities, no double-count.

---

# Chapter 2 — Database & data integrity
*Schema correctness, constraints, cascades, and that the code's reads/writes match the schema.
Use the read-only REST API for live checks; read migrations for schema truth.*

### 2.1 Schema vs code
- [ ] Every `.from('<table>')` table exists in migrations (15 tables).
- [ ] Every column written by the hooks exists in the schema (no silent dropped fields).
- [ ] Enums (document_type incl. mortgage_statement/loan_statement; repayment_type; payer) match code.
- [ ] Local migrations == remote (`supabase db push --dry-run` says up to date).

### 2.2 Foreign keys & cascades
- [ ] `properties` delete → contracts/mortgage_tracks/etc. cascade or SET NULL as intended.
- [ ] `loans` have own owner_id + SET NULL property FK → not orphaned on property delete (regression: reset must clear loans — verify still fixed).
- [ ] `contracts` delete → contract_utilities + rent recurring_items cleaned (no orphan rent tasks).
- [ ] `transactions.recurring_item_id` / `document_id` nullable FKs behave on parent delete.
- [ ] `documents` delete also removes storage objects (no orphaned files).

### 2.3 Defaults, nullability, types
- [ ] Date columns are `date` (date-only) — confirms the string-compare approach is safe.
- [ ] Numeric columns (amounts, rates) precision is adequate (no rounding surprise).
- [ ] `renewal_alert_days` array default; `requires_approval` default.
- [ ] created_at / completed_at timestamps populated.

### 2.4 Owner-row invariant
- [ ] Every user gets an `owners` row (ensureOwnerRow upsert) before any FK insert.
- [ ] No write path inserts a child row before the owner row exists.

---

# Chapter 3 — Security & access isolation
*The most important for a multi-family release: each user sees ONLY their own data.*

### 3.1 RLS — owner isolation
- [ ] Every data table has `owner_scoped` RLS (owner_id = auth.uid()) for authenticated.
- [ ] Live check: anon key returns 0 rows across all tables (content-range */0).
- [ ] Live check: a user cannot read another owner's rows (simulate with a second owner_id filter).
- [ ] `push_log` is service-role only (no client policy).
- [ ] `feedback`: any authenticated inserts own; only admin reads/deletes all.
- [ ] Migration 026 (drop anon policies) applied on remote.

### 3.2 Auth
- [ ] Session persists across reloads; sign-out clears it + google token.
- [ ] Manager account (`dev@test.local`) requires the password; not guessable.
- [ ] DEV_BYPASS is OFF in prod build (`build:prod` clears the env).
- [ ] No service-role key or secrets shipped to the client bundle.

### 3.3 Input / output safety
- [ ] User text (descriptions, notes, names) rendered as text (React escapes) — no XSS via dangerouslySetInnerHTML anywhere.
- [ ] Amounts/numbers are parsed/validated before DB write (no NaN persisted).
- [ ] File upload: type/size constraints; storage path not user-controlled to escape the bucket.
- [ ] Signed URLs for documents expire; not long-lived public.
- [ ] No personal data in URL query params.

### 3.4 Storage
- [ ] Documents bucket RLS scoped to owner; anon storage policies dropped (003→026).
- [ ] Receipt/doc access goes through signed URLs, owner-scoped.

---

# Chapter 4 — Auth & Login
### 4.1 Magic link
- [ ] Enter email → "we sent a link" confirmation; resend works.
- [ ] Invalid email → friendly error.
- [ ] Link lands back in the app and creates a session + owner row.
### 4.2 Google
- [ ] Google button → OAuth; returns and signs in; only basic scopes (tasks scope dropped).
- [ ] iOS PWA OAuth break-out to Safari handled (known constraint).
### 4.3 Manager
- [ ] "כניסת מנהל" → password → dev account; wrong password → error.
### 4.4 States
- [ ] Loading/busy states on each button; no double-submit.
- [ ] Body lock on login; released on unmount.

---

# Chapter 5 — Onboarding (LOCKED — regression-only, don't redesign)
### 5.1 Flow & navigation
- [ ] documents → purchase → mortgage → loans → investment → rental → insurance → done.
- [ ] Back chevron behaves at each step; welcome/documents handled.
- [ ] Optional steps show "אופציונלי"; FinishEarly commits + jumps to done.
### 5.2 Data persistence
- [ ] Each step's data saves; partial/half-filled forms are captured, not silently dropped.
- [ ] start_date anchoring (key delivery / signing / today) applied to tracks/loans/balloon.
- [ ] Derived equity = price − mortgage − loans − balloon.
- [ ] Doc uploads persist (fire-and-forget after critical writes).
### 5.3 AI extraction (DO NOT trigger billed calls — read code + use harness)
- [ ] extract-mortgage/contract/rental/loan invoked correctly; multi-file payload.
- [ ] Extraction cached by content hash (no re-charge on re-upload).
- [ ] Finish-while-extracting guard: pendingFinish fires real handleFinish after reads settle.
### 5.4 Done screen
- [ ] Property summary metrics reflect what was entered.
- [ ] Notifications opt-in states (iOS-not-installed hint vs enable button).

---

# Chapter 6 — App entry / routing / splash
- [ ] Splash holds on home until data ready; non-home cold-start renders immediately (regression of F1).
- [ ] 5s safety ceiling still releases the splash if a query hangs.
- [ ] Legacy deep-link redirects (mortgage/liabilities/tasks/documents → new pillars) work.
- [ ] `hasProperty === null` → splash; no property → onboarding; property → app.
- [ ] Bottom-nav active state correct on each route; back/scroll reset on route change.
- [ ] SW navigate postMessage → in-app route (no full reload).

---

# Chapter 7 — Home / Dashboard
### 7.1 Action center
- [ ] Rent-due action appears when monthlyRent>0 and not yet received; "אשר" records income.
- [ ] Open tasks (top 2, smart-sorted) appear; "סיים" completes optimistically; "+ עוד X" navigates.
- [ ] Renewal alerts (≤45 days) appear and link to rental.
- [ ] "הכול מטופל" when nothing pending; greeting by time-of-day.
### 7.2 Quick capture
- [ ] Free-text with amount → records inline + flash; without amount → opens expense sheet seeded.
- [ ] Quick income treated as one-off extra income (not rent line).
- [ ] Expense / task FAB sheets open and save.
### 7.3 Cash-flow card
- [ ] Forecast = max(expected, actual rent) + extra income − fixed − extra expenses.
- [ ] Rent progress bar; "התקבל" chip when cleared; no-lease invitation when no active contract.
- [ ] Expandable extra income/expense sublists.
- [ ] Signed-currency formatting consistent (regression of the bidi fix).
### 7.4 New-user / empty
- [ ] No property → EmptyState to set up.
- [ ] Property but no tenant → add-lease invitation; note variant.

---

# Chapter 8 — Ledger (תזרים)
### 8.1 Views
- [ ] Month / Year / Range toggle; period nav (prev/next) correct in RTL.
- [ ] Year view 12-month bar chart; drill to month; "best month".
- [ ] Range view: month bars (≤18mo) vs year bars; key-delivery preset.
### 8.2 Summary
- [ ] Balance = income − expense for the period; in/out tiles; proportion bar.
- [ ] Tabular figures align (regression).
### 8.3 Transactions
- [ ] Real transactions + forecast (תחזית) rows; forecast dedup vs real.
- [ ] "קבוע" tag on fixed-category real transactions (regression of the new feature).
- [ ] Category breakdown (expense by category) with colors/percentages.
- [ ] Swipe row: drag reveals edit/delete; full-swipe commits; tap closes.
### 8.4 CRUD
- [ ] Add transaction (income/expense, amount validation, category, payment, date, description).
- [ ] Edit (optimistic merge + drawer close; rollback on failure).
- [ ] Delete (optimistic remove; rollback on failure).
- [ ] Receipt attach/remove (upload, primary doc, signed-URL open).
- [ ] Prefill from task follow-up opens drawer pre-filled (fires once).
- [ ] Empty month → EmptyState (regression).

---

# Chapter 9 — Wealth (הון)
### 9.1 Display
- [ ] Net equity hero; ownership %; 3-segment bar (yours/family/banks) sums to value.
- [ ] "+X לבעלות החודש" = this month's principal.
- [ ] Equity accelerator: interest vs principal split of the monthly payment; annual conversion.
- [ ] Financing structure: mortgage (blended) + loans + balloon, balances, payoff %.
- [ ] Cumulative cashflow (rent received vs invested+interest+maintenance); net sign.
- [ ] Secondary: gross yield, monthly rent, invested — only shown when nonzero.
### 9.2 Editor
- [ ] "ערוך מימון ועלויות" opens; mortgage tracks add/edit/delete; loans; investment costs.
- [ ] Track type badges render (incl. teal — dark-mode regression).
- [ ] Save → refetch updates the hero numbers.
- [ ] Empty (no data) → EmptyState with editor CTA (regression).

---

# Chapter 10 — Property Admin
### 10.1 Binder & property
- [ ] Address, value, sub-parts; lease badge (active green / none amber).
- [ ] Edit/Add property modal (PropertyForm) — all fields save; address/block-parcel round-trip.
- [ ] estimated_value edit flows to equity/yield.
### 10.2 Rental
- [ ] Contracts list; active/expired status by days-left; add/edit; inline delete confirm (regression).
- [ ] Utilities matrix (tenant/owner + amount); chips render.
- [ ] Save syncs rent recurring item (requires_approval, check-deposit reminder).
- [ ] Delete clears rent recurring items (no orphan).
- [ ] Empty → single CTA (regression).
### 10.3 Insurance
- [ ] Policies list with renewal badges; add/edit; inline delete confirm.
- [ ] Total monthly premium; empty → single CTA (regression).
### 10.4 Tasks
- [ ] Inline add (Enter); complete (optimistic) + follow-up; smart sort; filters.
- [ ] Empty → "הכול תחת שליטה".
### 10.5 Documents
- [ ] Upload; type badges/icons; signed-URL open; grouping; empty → CTA.

---

# Chapter 11 — Settings
- [ ] Account: email + real provider (regression); sign out.
- [ ] Appearance (מראה): light/dark/system toggle persists + overrides OS (regression).
- [ ] Notifications: all push states (unsupported/not-installed/denied/default/granted); enable/disable/test.
- [ ] Generation section gated to dev/admin (regression); reset-all gated (regression).
- [ ] Admin feedback list (admin only); delete feedback.
- [ ] Google Tasks section hidden (GOOGLE_TASKS_ENABLED=false).

---

# Chapter 12 — Recurring / monthly generation / reminders
- [ ] `useMonthlyGeneration` runs once/month (localStorage month-key guard).
- [ ] Generates approval tasks for requires_approval recurring items past their day.
- [ ] Auto-posts non-approval recurring items as transactions.
- [ ] Contract renewal alerts within renewal_alert_days.
- [ ] No duplicate generation; no generation for inactive months.
- [ ] daily-reminders edge function: date-string compares (Israel today); once/day push_log guard; dead-subscription cleanup (read code, don't invoke prod).

---

# Chapter 13 — Cross-cutting UI
- [ ] Empty states consistent (ClayIllustration) across all lists.
- [ ] Loading skeletons per section; no layout shift.
- [ ] Error states (PageError) friendly + retry on every data screen.
- [ ] RTL correctness: alignment, chevron directions, number/sign placement, nav order.
- [ ] Responsive: 320 / 375 / 393 / tablet / desktop — no overflow; desktop sidebar.
- [ ] Dark mode: every screen + form + native control + badge (regression sweep).
- [ ] Number formatting (tabular, he-IL), date formatting (he-IL), currency consistency.
- [ ] Touch targets ≥44px; focus states; reduced-motion respected.
- [ ] Modals/sheets: scroll containment, swipe-to-close, scrim, body-lock release.

---

# Chapter 14 — PWA
- [ ] Manifest valid (name, RTL, standalone, portrait, colors); all icon assets present.
- [ ] theme-color light + dark variants; color-scheme follows theme.
- [ ] Service worker: push handler shows RTL notification; notificationclick focus/navigate.
- [ ] SW no-cache header; updates propagate.
- [ ] Install flow (add to home screen) — iOS hint where needed.
- [ ] Offline: graceful state (no white screen of death).
- [ ] Push subscribe/unsubscribe/test from Settings (desktop-verifiable; real iOS = device).

---

# Chapter 15 — Code quality / error handling / edge cases
- [ ] Every async write has error handling + user feedback (flash/alert/role=alert).
- [ ] Optimistic updates roll back on failure everywhere (transactions, tasks, edits).
- [ ] No `toISOString().slice(0,10)` for stored/compared dates (UTC-rollback class).
- [ ] No unhandled promise rejections; no console errors on any screen.
- [ ] Large numbers / long text / many items don't break layout.
- [ ] Division-by-zero / empty-array guards in all calculations.
- [ ] No dead code / unused exports introduced; tsc + build clean.
- [ ] `noUnusedLocals`/`noUnusedParameters` respected.

---

## Findings log
*(Bugs found while executing, with severity + fix commit. Newest first.)*

### Critique audit (2026-06-25) — external review of gaps
Investigated each claim against the code; outcomes:

**FIXED — `quickParse` multi-sentence description noise.** The amount was already correct (always the FIRST number, so "…350… הרגיל 500" → 350, not 500). But the *description* dragged in the later sentence. Now cut to the first sentence (`split(/[.\n]+/)[0]`): "שילמתי 350 שח על אינסטלטור. …500." → desc "אינסטלטור". Test added. (quickParse.ts)

**🟡 OPEN — needs owner decision: CPI indexation (הצמדה למדד) NOT modelled.** The amortization (`mortgage.ts`/`loans.ts`) reads only `annual_rate` and never `track_type`, so a **קבועה צמודה / variable צמוד** track is computed as *nominal* — the real balance grows with the CPI, so the app **understates debt and overstates equity** over time for indexed tracks. Modelling it needs a CPI assumption (input or fixed estimate) — a product call. Until then, consider a UI disclaimer ("לא כולל הצמדה למדד") on linked tracks. (Not auto-changed — would require inventing a CPI rate.)

**🟡 OPEN — feature gap: partial prepayments (פירעון מוקדם).** No way to record a lump-sum prepayment (shorten term vs. lower payment). "נפרעו %" assumes the standard schedule. Future feature.

**✅ VERIFIED SAFE — XSS / cross-tenant.** No `dangerouslySetInnerHTML`/`innerHTML` in the codebase → React escapes all interpolated text (descriptions, notes, **feedback** read by the admin). Combined with per-owner RLS (User B never loads User A's rows), an injected `<script>` renders as literal text. Locked as a Ch.3 invariant.

**✅ VERIFIED (mostly) — storage orphan on delete.** `documents` parent FKs are `ON DELETE SET NULL` (rows are NOT cascaded by property/contract/transaction delete — the file stays *tracked*, just unlinked). Every user-facing document delete (`useDocuments.deleteDocument`, `FinancesV2.removeReceipt`, Settings reset-all) `storage.remove()`s the file first. The only true orphan path is **owner/account deletion** (`documents.owner_id … on delete cascade` removes rows but not Storage files) — but account deletion isn't an app flow. Note for a future "delete account" feature: purge the bucket prefix first.

### BUG #9 🔴 — monthly generation built invalid dates for end-of-month recurring items — FIXED
`useMonthlyGeneration` built `txDate = year-month-day_of_month` with no clamp. A recurring item with `day_of_month` 29/30/31 produces an **invalid date** in a shorter month (e.g. `"2026-02-31"`), which rejects the whole batch `transactions.insert` (and the tasks insert) → **ALL automatic transactions + approval tasks for that month silently fail to generate**, and (catch block) it retries forever without setting the month key. Reachable for anyone whose rent/mortgage/loan day is past the 28th. Fixed: clamp `day = min(day_of_month, lastDayOfMonth)` via the already-tested `monthEndISO`. Verified by reasoning + build (the hook is Supabase-coupled; the clamp rests on tested `monthEndISO`).

### 🟡→✅ RESOLVED — renewal alert re-created across months
Was: the renewal-task dedup filtered `due_date >= today`, re-creating the task monthly. Owner then specified the desired behavior (renewal task once at ~2 months, recurring reminders via push). Fixed: dedup now matches ANY open renewal task; the monthly/fortnightly cadence moved to the daily-reminders push (reminder_log). (commit ff32ca7)

### BUG #8 🟠 — `activeContract` skewed the lease active/inactive at the day boundary — FIXED
`projections.ts activeContract` compared `new Date(c.start_date)` (UTC midnight) against a LOCAL `asOf` instant. On a contract's exact start/end date, the lease read inactive for part of the day in Israel (e.g. expired ~04:00 on its last valid day). Drives the Home rent action and Wealth monthly rent. Test (boundary at 00:30 start / 10:00 end) caught it; fixed to inclusive LOCAL date-string comparison.

### Guard audit (Ch.15 partial) — wealth percentage calcs are well-guarded
`WealthAccelerator` (returns null when total ≤ 0), `OwnershipScore` (propertyValue>0 guard), `FinancingStructure.mortgagePaidPct`/`paidPct` (denominator guards) — no NaN. One trivial hardening applied: `blendedRate` now guards `sum(principal)>0` (was `tracks.length`) so a stray 0-principal track can't show "NaN%".

### BUG #2 🟠 — UTC-date roll-back was SYSTEMIC (6 more sites) — ALL FIXED
The same `toISOString().slice(0,10/7)` pattern (UTC, rolls back a day/month in Israel) was in 6 more places, all comparing against LOCAL-dated schedule rows or driving "today". Each undercounts/misattributes during the late-night window (and on the 1st of the month). Found by tests + grep; all fixed to local-date helpers; tests added where unit-testable:
- `loans.ts loanBalance` 🟠 — outstanding balance ~one full principal payment too high at midnight on a payment date (feeds ownership % / bank debt). Test: as-of value must not depend on time-of-day.
- `loans.ts loanInterestToDate` 🟠 — interest-paid short by a month. (added `localISO` helper for both.)
- `equity.ts ym()` 🟠 — `toISOString().slice(0,7)` → on the 1st at midnight the "מאיץ ההון" accelerator showed the PREVIOUS month's principal/interest split. Test caught it (May shown instead of June).
- `projections.ts monthlyVirtualEntries` 🟠 — year/range forecast dropped the CURRENT month's rent/mortgage rows on the 1st at midnight. Fake-clock test (00:30 on the 1st) caught it. → `todayISO()`.
- `useDashboardStats.ts` 🟡 — renewal-alert window (today / +90d) shifted a day. → `todayISO()`/`monthDayISO`.
- `useMortgageData.ts` 🟠 — mortgage current balance picked the prior month's row at midnight on a payment date. → `todayISO()`.
- `LiabilitiesV2.tsx` 🟡 — new mortgage-track/loan forms defaulted start_date to yesterday in the late-night window. → `monthDayISO(new Date())` (×4).

**Net: the entire `toISOString().slice` date-compare class is now eliminated** (`grep` clean except a doc comment). The codebase already had `todayISO`/`monthDayISO`/`monthEndISO` for exactly this — these sites predated or missed the convention.

### BUG #1 🟠 — `interestToDate` used a UTC date cutoff (off-by-one-day) — FIXED
`lib/mortgage.ts interestToDate` compared the (local-dated) schedule rows against `asOf.toISOString().slice(0,10)` — a UTC date. In Israel (UTC+3) that cutoff lands on the *previous* day, so a payment row dated "today" (1st of the month) is dropped from the "interest paid to date" total. Feeds the Wealth screen's "ריבית ששולמה" (via `useMortgageData` + `useInvestmentData`). Test (`mortgage.test.ts`, run under `TZ=Asia/Jerusalem`) proved it: returned 4 months' interest instead of 5 (336₪ short in the fixture). Fixed to a LOCAL Y-M-D cutoff, matching the `addMonths` pattern in the same file. Low real-world frequency (only the late-night window with a 1st-of-month payment) but a genuine correctness + convention bug.
