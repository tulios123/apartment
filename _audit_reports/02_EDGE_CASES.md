# 02 — Edge Cases & Degradation Map

> Unhandled edge cases per module: timezone/date math, races, financial degeneracies,
> offline/flaky network, data-shape surprises, empty states.
> Audit date: 2026-06-26.

---

## A. Date / Timezone (the app's most fragile surface)

The codebase is *mostly* disciplined about local dates (`todayISO`, `monthDayISO`, `monthEndISO`, and `new Date(iso + 'T00:00:00')` in `mortgage.ts`/`loans.ts`). But three places still parse bare `YYYY-MM-DD` as **UTC** and do arithmetic on it, which is correct *only because Israel is ahead of UTC* — fragile and inconsistent.

- **EDGE-01 · `useMonthlyGeneration.ts:142` — renewal `daysLeft` off-by-one.**
  `Math.ceil((new Date(contract.end_date).getTime() - today.getTime()) / 86400000)` mixes a UTC-midnight `new Date(end_date)` with an absolute `today`. Near local midnight the ceil can land a day early/late. The **edge function computes the same value correctly** via integer string math (`daysBetween`, `index.ts:18-22`), so the renewal task title (client) and the push line (server) can disagree by a day.
  *Fix:* replace with the string-based `daysBetween(todayISO(), end_date)`.

- **EDGE-02 · `useDashboardStats.ts:101` — upcoming-renewal `daysLeft` off-by-one.** Same `new Date(c.end_date).getTime() - now` pattern feeding the home "נגמר בעוד X ימים". Use string diff.

- **EDGE-03 · `projections.ts:8-14 / 46-56` — UTC parsing inconsistent with loans/mortgage.** `elapsedMonths` and `rentReceivedToDate` use `new Date(startStr)` (UTC), while `loans.ts`/`mortgage.ts` use `new Date(iso + 'T00:00:00')` (local). Works today for Israel but breaks for any user/runtime behind UTC and is a latent month-boundary bug. *Fix:* standardize on `new Date(iso + 'T00:00:00')` everywhere, or compute month diffs from the string components directly.

- **EDGE-04 · `format.ts:16-19` — `formatDate` is timezone-dependent (display).** `new Date('2026-03-15').toLocaleDateString('he-IL')` renders in the *viewer's* zone. A family member traveling **behind** UTC sees every stored date **one day earlier**. The app stores/compares in local strings but re-introduces the Date-parsing skew at display. *Fix:* format from the `YYYY-MM-DD` parts (or parse with `T00:00:00`).

- **EDGE-05 · `rentReceivedToDate` counts a full month on day 1.** `months = monthDiff + 1`, so a lease starting today immediately contributes a whole month of rent to the dashboard "income". Inflates the headline before any rent is actually collected. By design (projection), but surprising. Document or floor to elapsed-only.

- **EDGE-06 · Month rollover while app stays open.** `useMonthlyGeneration` keys on `currentMonthKey()` captured at mount; `useDashboardStats`/`HomeScreen` capture `year/month` at mount. An app left open across midnight on the 1st won't regenerate or re-scope until remount. Minor.

## B. Races & Idempotency

- **EDGE-07 · `useMonthlyGeneration.ts` cross-tab / cross-device TOCTOU.** The `inFlight` guard (line 12) is a **module-level boolean — per JS context only**. Two devices (or two PWA windows) opening in the same month both read "no existing tx/tasks", then both insert. The `generatedIds`/`taskIds` dedup narrows the window but does not close it (classic read-then-write race) → possible duplicate generated transactions/tasks/renewal tasks. The `localStorage` month-key is also per-device. *Fix:* make generation idempotent at the DB layer — a unique constraint on `(owner_id, recurring_item_id, date)` for generated transactions and `(owner_id, recurring_item_id, due_date)` for generated tasks, with `insert ... on conflict do nothing`.

- **EDGE-08 · SW → app `postMessage` lost if the listener isn't mounted.** `public/sw.js:30-42` focuses the first window client and immediately `postMessage({type:'navigate'})`. The listener lives only in `Layout.tsx:33-40`, which is **not mounted on Login/Onboarding** or during cold paint. Tapping a notification while the app sits on a non-app screen focuses it but **never navigates** (message dropped). `includeUncontrolled:true` can also target a client with no listener. *Fix:* queue the target URL (e.g. SW stores it / posts with retry, or the client reads `?notif=` on focus), and add the message listener at the app root, not only inside the authed Layout.

- **EDGE-09 · `daily-reminders` approval section is un-throttled — daily nagging.** Section 1 (lines 95-114) re-lists every unrecorded approval item **every day** from its `day_of_month` until recorded. Combined with EDGE/duplicate C6, an unpaid item nags daily with a doubled line. Lease reminders are throttled via `reminder_log`; approvals are not. *Consider* a similar cadence cap, or stop once a task exists.

- **EDGE-10 · `push_log` release races.** On "nothing pending" (line 169) or "all sends failed" (line 203) the day-claim row is deleted so a later run can retry. Two same-day invocations could both pass the claim if the first deletes between the second's insert attempt. Low impact (worst case: a second notification same day). Acceptable; document.

- **EDGE-11 · No `pushsubscriptionchange` handler.** `public/sw.js` never handles `pushsubscriptionchange`; `push.ts` never re-subscribes on rotation. When the browser rotates/expires the endpoint, the stored subscription goes dead and the user **silently stops receiving pushes** until they toggle it off/on in Settings. The daily function prunes 404/410 endpoints but nothing re-creates them. *Fix:* add a `pushsubscriptionchange` SW handler that re-subscribes and re-upserts; opportunistically re-`enablePush` on app open if `getSubscription()` is null but permission is granted.

## C. Financial degeneracies (`mortgage.ts` / `loans.ts`)

The amortization math is solid (Shpitzer, grace handled, last-row rounding-drift absorbed, `r=0` linear path). Edge inputs:

- **EDGE-12 · `grace_months >= term_months` → never-amortizing schedule.** `trackSchedule` (and `loanSchedule`) with grace ≥ term makes every month interest-only (`effectiveTerm <= 0` → `postGracePay = 0`); `balance` stays at `principal` forever, "balance" never reaches 0, "months remaining" misbehaves. Onboarding validates that term exists but **not** `grace < term`. *Fix:* validate `grace_months < term_months` in `TrackForm`/`LoanForm`; clamp or warn.

- **EDGE-13 · Negative / prime-minus effective rate.** Loan/track rate is `prime + margin` and margin can be negative ("פריים מינוס"). If `prime + margin <= 0`, `loanReady`/`trackReady` treat it as "missing rate" (`<= 0`), and the Shpitzer `r` could be ≤ 0 → falls into the `r===0` linear branch (acceptable) but a *slightly negative* `r` would produce odd numbers. Verify extraction can't yield a net-negative rate; clamp `r` at 0.

- **EDGE-14 · Floating-point money.** All sums (`reduce((s,t)=>s+t.amount)`, `expectedNet`, schedule totals) are float. Display rounds via `formatCurrency` (`maximumFractionDigits:0`), so **comparisons** are the risk: `rentReceived >= monthlyRent` (`HomeScreen:101`) could flip on sub-agora drift if rents ever carry decimals. Low likelihood (whole-shekel rents) but unguarded. *Fix:* compare with a cent epsilon, or store/compare integer agorot.

- **EDGE-15 · `combineSchedules` cost.** O(dates × tracks × rows) with `.find` per cell — ~hundreds of thousands of iterations for a 30-year, multi-track mortgage. Runs rarely; fine now, watch if it lands in a hot render path.

## D. Input / parsing / files

- **EDGE-16 · `ExpenseSheet` numpad guards.** `Number('')`→0, `Number('0.')`→0, `Number('.')`→NaN — all blocked by `canContinue = numeric>0`. Backspace long-press vs trailing click (`backCleared` ref, lines 106-130): if the platform fires no `click` after the long-press pointer sequence, `backCleared` can stay `true` and **swallow the next legitimate backspace**. Edge, platform-dependent.

- **EDGE-17 · No receipt/file size or type ceiling.** `ExpenseSheet` accepts `image/*,.pdf,.heic`; `storage.ts` does no size check. A large/HEIC receipt that exceeds the storage limit fails inside the swallowed `try/catch` (C7-A) — silent. *Fix:* validate size client-side, show progress/failure.

- **EDGE-18 · Extensionless files.** `storage.ts:13` `ext = file.name.split('.').pop()`; a file named `receipt` (no dot) yields path `…/docId.receipt`. Cosmetic, but breaks type inference on re-open.

- **EDGE-19 · `quickParse` misclassification.** `INCOME_RE` matches `הפקד` / `החזר` / `זיכוי`, so "הפקדתי 500 בבנק" classifies as **income**. Also Home's quick-add always writes category `'אחר'` (`HomeScreen:244`) ignoring `predictCategory`, so "תיקון ברז 350" lands as `אחר`, not `תיקונים` (inconsistent with the full sheet). Low stakes; document.

## E. Empty / first-run states

- **EDGE-20 · New user, no property** — handled (`HomeScreen` EmptyState; `App.tsx` routes to Onboarding). Good.
- **EDGE-21 · Property but no contract** — handled ("אין חוזה שכירות פעיל" add-lease card; push "no-lease" nudge gated on having a property so brand-new users aren't nagged). Good.
- **EDGE-22 · No tasks / no transactions** — Home action center shows "הכול מטופל"; flow card shows fixed-only note. Good. Verify `FinancesV2`, `WealthHub`, `PropertyAdminHub` each render a clean empty state with zero rows (not a bare skeleton or NaN).
- **EDGE-23 · `undefined`/`null` data-shape assumptions.** Several reducers/maps assume well-formed rows: `policies.reduce(... p.monthly_premium ?? 0)` (guarded, good) vs raw `t.amount` sums (unguarded — a null amount yields `NaN` that poisons the whole total and, with no error boundary (C4), can crash a downstream `.toLocaleString`). Defensive-coerce numeric fields at the hook boundary.

## F. Auth / session

- **EDGE-24 · `ensureOwnerRow` not awaited on the warm-session path** (`AuthContext.tsx:51`). For a returning user the row exists, so writes succeed; but a brand-new user whose first event is `getSession` (not `SIGNED_IN`) could, in theory, issue an FK-dependent insert before the owner upsert resolves. Low likelihood; consider awaiting or retrying owner-FK failures.
- **EDGE-25 · Stale local session on write.** `getOwnerId()` (`useTransactions`/`useTasks`) reads `getSession()` (local, no network) for speed; if the token is expired and not yet refreshed, the write hits RLS with a stale JWT and fails. Supabase auto-refresh usually covers this; surface a friendly retry if a write returns an auth error.
- **EDGE-26 · Missing env at build.** `supabase.ts` calls `createClient(url, key)` with no guard; absent `VITE_SUPABASE_*` yields a cryptic runtime crash. Add an explicit check with a readable message.
