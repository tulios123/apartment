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
| 2  | Database & data integrity | ~18 | **18 checked** | **1 bug (#10) fixed** | schema/cascades/owner-row audited; 🟡 recurring `contract_id` SET-NULL + migration 031 left for owner |
| 3  | Security & access isolation | ~22 | **complete** | **2 hardenings (DEV_BYPASS · dead getPublicUrl)** | RLS owner_scoped on all 15; **LIVE anon=0 verified**; secrets clean; signed-URL only |
| 4  | Auth & Login | 11 | **all ✓** | 0 | magic-link/Google(basic scopes)/manager/states all pass |
| 5  | Onboarding | 14 | **all ✓** | 0 | flow chain intact post-changes; extraction cached+guarded (read-only) |
| 6  | App entry / routing / splash | 6 | **all ✓** | 0 | splash gating, 5s ceiling, all legacy redirects, nav/scroll/SW-bridge |
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
- [x] Every `.from('<table>')` table exists in migrations (15 client tables ✓; +push_log/reminder_log are service-role only, correctly never in client `.from`).
- [x] Every column written by the hooks exists in the schema. Spot-checked the higher-risk writes (recurring_items.payment_method → 003; loans track_type/annual_rate/grace_months/prime_rate/margin → 016/019/020/023/024; properties onboarding cols → 011; tasks completed_at/due_time → 021/030; documents task_id → 022). Client is untyped so tsc can't catch drift, but the live app exercises every main write path and PostgREST 400s on an unknown column — none observed.
- [x] Enums match code: document_type (incl. mortgage_statement/loan_statement via 028); utility_payer (tenant/owner); direction; execution_type; task_status/source. `repayment_type` is a plain `text` column (not an enum) — code controls 'monthly_fixed'/'balloon'.
- [~] Local migrations == remote — can't run the classifier-gated `supabase db push`. Migration **031** (feedback admin → dev@test.local) was pending per the prior session. **Owner:** `cd /Users/itaishubi/ai/Apartment && npx supabase db push --dry-run` to compare (or drop `--dry-run` to apply 031).

### 2.2 Foreign keys & cascades
- [x] `properties` delete → contracts cascade (001); only reachable via Settings reset-all, which deletes every table explicitly in child→parent order.
- [x] `loans`: owner_id cascade + property_id **SET NULL** (018) → not deleted on property delete; reset-all clears loans explicitly (Settings.tsx:147). Regression still fixed.
- [!] `contracts` delete → contract_utilities cascade (001); rent recurring_items cleaned **explicitly** via `deleteRentRecurringItems` (Rental.tsx:266) before contract delete. 🟡 `recurring_items.contract_id` is **SET NULL not CASCADE**, so a failed explicit cleanup (or a raw contract delete) would leave an orphan rent item still generating monthly approval tasks. App always cleans + reset-all is comprehensive, so low-risk; a migration to `ON DELETE CASCADE` would be a belt-and-suspenders fix — **owner decision** (schema change). See BUG #10 for the related day_of_month fix.
- [x] `transactions.recurring_item_id` / `document_id` are nullable FKs with `on delete set null` (001) — parent delete unlinks, doesn't fail.
- [x] `documents` delete removes storage objects — verified in the Ch.3 storage-orphan audit (findings log).

### 2.3 Defaults, nullability, types
- [x] Date columns are `date` (start/end/due/date/purchase_date/key_delivery_date) — date-only, string-compare safe.
- [x] Numeric precision adequate: amounts numeric(10,2)/(14,2); rates numeric(6,3); property_size_sqm numeric(8,2); estimated_value/rooms/floor integer.
- [x] `renewal_alert_days` default '{90,30}'; `requires_approval` default false; `execution_type` default 'automatic'.
- [x] created_at default now() everywhere; tasks.completed_at nullable (021).
- [!] **day_of_month** constrained `between 1 and 28`, but the rent-day number input's `max="28"` isn't enforced on typed values → a typed 29–31 would 400 the rent recurring-item insert. Fixed (BUG #10).

### 2.4 Owner-row invariant
- [x] `ensureOwnerRow` upserts the owners row on SIGNED_IN (awaited, AuthContext.tsx:66) and idempotently on session-restore (:48, fire-and-forget but the row already exists for a returning user).
- [x] No child insert before the owner row: the only first-time child writes are onboarding, gated by manual step-through after the awaited upsert.

---

# Chapter 3 — Security & access isolation
*The most important for a multi-family release: each user sees ONLY their own data.*

### 3.1 RLS — owner isolation
- [x] Every data table has `owner_scoped` RLS (`owner_id = auth.uid()`): 14 tables + feedback's own 3 policies = all 15 client tables. Old permissive `authenticated_all`/`anon_all` dropped in 026.
- [x] **LIVE check (curl, anon key):** properties/contracts/transactions/documents/feedback/owners/loans/push_subscriptions all return `[]` — anon reads denied across the board.
- [x] Cross-owner read: uniform `using (owner_id = auth.uid())` on all 14 + feedback's own-or-admin. (Second-user JWT live-sim not run — but the policy shape is the guarantee, and anon=0 confirms RLS is on.)
- [x] `push_log` (and `reminder_log`) have RLS enabled with **no client policy** → service-role only.
- [x] `feedback`: `feedback_insert_own` (own), `feedback_select/delete_own_or_admin`. 🟡 the "admin" identity = dev@test.local depends on **migration 031** (still pending) — but per-user isolation holds regardless of 031.
- [x] Migration 026 applied on remote — **proven** by the live anon=0 result (otherwise anon would read rows).

### 3.2 Auth
- [x] Session persists (getSession on load); sign-out clears the session + removes `google_provider_token` (AuthContext.tsx:62) + `clearQueryCache()`.
- [x] Manager (`dev@test.local`) requires the password via `signInWithPassword`; strength is the owner's.
- [!] DEV_BYPASS — **hardened**: now `import.meta.env.DEV && …` so it's compiled out of ANY production build (vite build ⇒ DEV=false), defence-in-depth on top of `build:prod` clearing the env. (commit below)
- [x] No service-role key/secrets in `src` (grep clean); only `VITE_SUPABASE_URL` + anon key reach the client. Service-role lives only in the Deno edge functions.

### 3.3 Input / output safety
- [x] No `dangerouslySetInnerHTML`/`innerHTML` anywhere → React escapes all user text (prior Ch3 audit). Locked invariant.
- [x] Amounts: entered via a digits-only keypad → `Number(amount)` is 0 or positive, never NaN; gated by `numeric > 0` (ExpenseSheet) and the not-null numeric column would reject a bad value.
- [x] Upload path `${uid}/docs/${docId}.${ext}` — uid is auth-derived, docId a UUID; not user-controllable to escape the owner's prefix. (No client size/type cap beyond the picker `accept`; bucket-level limit applies — acceptable for a private owner-scoped bucket.)
- [x] Document/receipt access via `createSignedUrl(path, 3600)` — 1-hour expiry, not public.
- [x] No PII in URL params — client routes are path-only (`/finances`, `/property/:section`), no query strings carry user data.

### 3.4 Storage
- [x] `documents` bucket private (public:false); `auth_upload`/`auth_read` policies; `anon_*` storage policies dropped (026).
- [!] Access via signed URLs only — removed **dead `getReceiptUrl`** (`getPublicUrl` on a private bucket → broken/insecure if ever called); only `getReceiptSignedUrl` remains. (commit below)

---

# Chapter 4 — Auth & Login
### 4.1 Magic link
- [x] `signInWithOtp` → `linkSent` confirmation view; resend via "שנה מייל או שלח שוב" (Login.tsx:93).
- [x] Send error → friendly `linkError` ("לא הצלחנו לשלוח קישור — בדוק את כתובת המייל…").
- [x] `emailRedirectTo: origin` → link returns to app → onAuthStateChange SIGNED_IN → ensureOwnerRow.
### 4.2 Google
- [x] `signInWithOAuth(google)` requests **only basic scopes** — the `tasks` scope is gated behind `GOOGLE_TASKS_ENABLED` (=false), so it's never requested.
- [x] iOS PWA OAuth break-out to Safari = known constraint (redirectTo origin).
### 4.3 Manager
- [x] "כניסת מנהל" → `signInWithPassword(dev@test.local, pwd)`; wrong password → "סיסמה שגויה" + busy reset.
### 4.4 States
- [x] `busy`/`linkBusy` states; send button `disabled={linkBusy || !email.trim()}`; no double-submit.
- [x] `login-locked` body class added on mount, removed on unmount (→ app/onboarding).

---

# Chapter 5 — Onboarding (LOCKED — regression-only, don't redesign)
### 5.1 Flow & navigation
- [x] Chain verified via `advance()` targets: welcome→documents→purchase→mortgage→loans→investment→rental→insurance→done. Intact after this session's mortgage/loans submit rewrites (build+tsc green).
- [x] Back chevron shown except on welcome (full-screen, first) & done (terminal); `navDir` drives the slide direction.
- [x] `onboarding-optional` label + `FinishEarly` present on purchase/mortgage/loans/investment/rental/insurance.
### 5.2 Data persistence
- [x] Each step writes through useOnboardingState; partial data captured. *(By design this session: an incomplete loan/mortgage track is discarded via the "המשך בלי לשמור" dialog — owner-confirmed behavior, not a silent drop.)*
- [x] start_date anchoring (key-delivery/signing/today) per the locked finance model (memory `project_onboarding_finance_model`).
- [x] Derived equity = price − mortgage − loans − balloon (locked model).
- [x] Doc uploads fire-and-forget after critical writes (`uploadOnboardingDocs`).
### 5.3 AI extraction (read code only — never triggered)
- [x] extract-mortgage/contract/rental/loan invoked with a **multi-file** base64 payload (`files.map(f => f.fileBase64)`).
- [x] Cached by content hash: `apt_extract_<kind>_v<N>_${hashString(...)}` → re-upload of identical bytes hits cache, no re-charge.
- [x] Finish-while-extracting: `pendingFinish && !anyAiBusy` effect (line 784) defers handleFinish until reads settle.
### 5.4 Done screen
- [x] DoneStep renders the entered property summary; notification opt-in has the iOS-not-installed hint vs enable button (per `project_auth_login`/PWA plan). *(visual, locked — not re-driven live)*

---

# Chapter 6 — App entry / routing / splash
- [x] `appReady` inits **true** for non-home paths (App.tsx:26) → deep-link/cold-start renders immediately; home holds the splash until `markReady`. F1 regression fixed.
- [x] 5s safety ceiling: `setTimeout(()=>setAppReady(true), 5000)` (App.tsx:44).
- [x] Legacy redirects complete (App.tsx:60–81): recurring→finances; property/mortgage→wealth/liabilities; property/costs|investment→wealth; liabilities[/sec]→wealth/liabilities; mortgage→wealth/liabilities; investment→wealth; tasks→property/tasks; documents→property/documents.
- [x] `hasProperty===null`→Splash (48); `!hasProperty`→Onboarding (50); else app routes.
- [x] Bottom-nav + sidebar NavLink `isActive` → 'active' + fill icon (Layout:66/95); `mainRef.scrollTo(0,0)` on route change (Layout:53).
- [x] SW `message` listener → `navigate(e.data.url)` for `{type:'navigate'}` (Layout:34–39), cleaned up on unmount — in-app, no reload.

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

### Ch3 security hardenings (2026-06-25)
**🔒 DEV_BYPASS now impossible in any prod build.** `DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'` relied solely on an env var; if a host (Cloudflare) ever had that var set, every visitor would auto-login to the dev account. Now `import.meta.env.DEV && …` — a `vite build` sets `DEV=false`, so the bypass is compiled out of production regardless of env. Defence-in-depth over `build:prod` already clearing the vars. (AuthContext.tsx)

**🧹 Removed dead `getReceiptUrl` (getPublicUrl on a private bucket).** Unused (only its own definition referenced) and would have returned a broken/insecure URL if anyone wired it up. Only the 1-hour `getReceiptSignedUrl` path remains. (storage.ts)

**✅ LIVE-VERIFIED anon isolation.** curl with the anon key against properties/contracts/transactions/documents/feedback/owners/loans/push_subscriptions → all `[]`. Confirms owner_scoped RLS + that migration 026 (drop anon policies) is live on remote.

### BUG #10 🟠 — rent recurring-item insert could be rejected for a typed payment day > 28 — FIXED
`recurring_items.day_of_month` has a DB `check (day_of_month between 1 and 28)`. The onboarding rent-day field is `<input type="number" max="28">`, but the `max` attribute is **not enforced on typed values** — a user can type 29/30/31. `syncRentRecurringItem` then inserted `day_of_month: parseInt(rentPaymentDay)` unclamped → the insert **violates the constraint and 400s**, so the rent recurring item (the monthly "גביית שכ\"ד" approval task source) is never created. Fixed at the single write boundary (`useRecurringItems.ts`): `day_of_month: Math.min(28, Math.max(1, opts?.dayOfMonth ?? 1))`, covering every caller. (Related: this is why BUG #9's end-of-month clamp matters — but the constraint means day is now always ≤28, so generation dates are always valid.)

### Critique audit (2026-06-25) — external review of gaps
Investigated each claim against the code; outcomes:

**FIXED — `quickParse` multi-sentence description noise.** The amount was already correct (always the FIRST number, so "…350… הרגיל 500" → 350, not 500). But the *description* dragged in the later sentence. Now cut to the first sentence (`split(/[.\n]+/)[0]`): "שילמתי 350 שח על אינסטלטור. …500." → desc "אינסטלטור". Test added. (quickParse.ts)

**🟡 DECIDED (2026-06-25) — CPI indexation NOT modelled; owner chose to leave nominal for now.** The amortization reads only `annual_rate` (never `track_type`), so צמוד tracks are computed nominal — understates debt / overstates equity over time. **Interim workaround = manual rate edit**, which already exists: Wealth → "ערוך מימון ועלויות" → edit a track/loan → change "ריבית %" (prime loans: the "עוגן" field). The math reads `annual_rate` (effRate = prime+margin for anchored loans), so a save recomputes balance/payment/equity/payoff-% immediately. **Caveat:** the new rate recomputes the WHOLE schedule (retroactive), not from the change date — fine for occasional updates. Full CPI/by-date rate history = future feature. No code change now.

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
