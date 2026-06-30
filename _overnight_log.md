# Overnight QA + Hardening Run

> Autonomous run started while the owner sleeps. Goal: make the family-facing app
> bulletproof — find real bugs across the whole app, fix the high-confidence/low-risk
> ones (verified, committed per fix), and leave a clear list of anything risky/ambiguous
> for morning review. **No new features** (the monthly-close screen is explicitly skipped).
> Principle: don't ship a destabilizing change unattended — when a fix is behavioral or
> ambiguous, log it under "Needs your call" instead of guessing.

## Plan (phases)
1. **Bug hunt** — adversarial multi-agent review across 8 areas (onboarding, dashboard,
   finances, wealth/liabilities, property/rental/insurance, core hooks/lib, docs/settings,
   push/SW/edge). Every finding verified by a second agent. → confirmed list with risk tags.
2. **Fix** — apply the `autofix` (mechanical/low-risk) confirmed findings, commit each,
   tsc/build green. Flag `review` ones below.
3. **Old feedback triage** — go through the remaining feedback-table items, fix the still-valid clear ones.
4. **Push hardening** — finish any remaining E1/E2 gaps (pushsubscriptionchange SW handler).
5. **Live smoke** — walk the main flows as the dev account (AI-cost-free via the bypass), catch runtime issues, fix.
6. **Final verify** — tsc · tests · build · summary.

## Progress
- Phase 1 bug hunt: DONE (24 verified). Phase 2 fixes: 10 applied (commit 3c34689). 16 flagged below.
- Next: old-feedback triage, push hardening (pushsubscriptionchange), live smoke, verification review, final verify.

## Fixed (committed)
Bug hunt (8 areas, 24 verified bugs). Applied the 10 lowest-risk in commit 3c34689:
- A1 onboarding equity-% focus no longer seeds '0' (was silently dropping computed equity)
- A2 onboarding rental end-date auto-fill → parseLocalISO (timezone)
- A3 onboarding investment balloon: reset editBalloon on remove (was opening wrong row)
- A4 Home: single tracked flash-toast timer (overlapping timers cut toasts short)
- A5 Rental daysLeft/isActive → daysBetween/string compare (day-early in Israel)
- A6 Insurance renewal date → daysBetween (day-early)
- A7 Documents delete: try/catch/finally + surfaced error (stuck confirm UI)
- A8 Settings feedback delete: restore row + warn on failure
- R6 Finances edit-drawer receipt-attach failure now surfaced (was silent, incl. oversized)
- R5 Finances edit that moves a tx to another month refetches (was left stale in view)

## Needs your call (flagged — real bugs, but behavioral/critical-path/ambiguous; not auto-applied overnight)
Each verified real by a second agent. Highest priority first: **R15** (push leak — security), **R8** (mortgage data loss), **R1/R2** (malformed financial writes on onboarding finish), **R13/R14** (multi-account / reset), **R4** (forecast math). Say the word and I'll apply any/all.

### R1 · [med] An in-progress new loan typed but not saved bypasses the missing-fields gate and is written malformed
- **איפה:** src/components/onboarding/LoansStep.tsx:46-47 (effectiveLoans/incompleteLoans) and useOnboardingState.ts handleFinish loan write (lines 632-637, 682-706)
- **הבעיה:** The loans step's completeness gate (`incompleteLoans`) only maps over the saved `loans` array. The default new-loan form is shown (showLoanForm=true) and a user can type only a principal into it without tapping 'save loan' or '+'. Tapping 'הבא' does not block (the pending form isn't in `loans`), and editingLoanIdx is null so nothing is saved into `loans` either — but the partial loanForm persists. At finish, handleFinish's `pendingLoanValid && showLoanForm` branch pushes that partial loan, writing a monthly_fixed loan with annual_rate 0 and term_months null. That is a malformed monthly loan (no real amortization schedule) that the gate was supposed to prevent.
- **תיקון מומלץ:** Include the pending new-loan form in the gate when showLoanForm is true and loanForm has a principal — e.g. extend effectiveLoans/incompleteLoans to also consider loanForm when (showLoanForm && editingLoanIdx===null && parseFloat(loanForm.principal)>0), so the continue-prompt fires; or in handleFinish only push the pending loan when loanIsValid AND it passes the same rate/term completeness check used in the step.

### R2 · [low] In-progress new mortgage track bypasses the gate and is saved with fabricated default rate/term
- **איפה:** src/components/onboarding/MortgageStep.tsx:49-50 (effectiveTracks/incompleteTracks) and useOnboardingState.ts handleFinish (lines 617-630, normTrack)
- **הבעיה:** Same shape as the loans gate gap: incompleteTracks only maps over `tracks`. A user can type just a principal into the always-shown new-track form (showTrackForm=true) without saving it; submit doesn't block, and at finish handleFinish pushes it via `pendingTrackValid && showTrackForm`, with normTrack defaulting annual_rate to 5.000 and term to 360. The track is saved with made-up rate/term the user never confirmed (less harmful than the loan case because the defaults are plausible, but still a silently-fabricated financial record).
- **תיקון מומלץ:** Mirror whatever fix is chosen for the loans gate: include the pending track form in incompleteTracks when showTrackForm && editingIdx===null && principal>0 so the continue-prompt fires, instead of silently normalizing it at finish.

### R3 · [low] An empty/failed extraction result is cached, permanently blocking re-extraction of the same file
- **איפה:** src/components/onboarding/useOnboardingState.ts:318, 376, 453, 507 (localStorage.setItem of the edge result)
- **הבעיה:** All four aiFill* functions cache the edge response whenever `data` is truthy and there was no transport error — including a successful response that yielded no tracks/loans/fields (e.g. a blurry scan the model couldn't read). Because the cache key is content-addressed by file bytes, re-uploading the exact same file always hits the cached empty result and shows the 'לא זוהו…' error again, never re-calling the (non-deterministic) model. A user retrying the same blurry document can never get a second attempt without changing the file.
- **תיקון מומלץ:** Only cache when the result actually contains usable data (e.g. mapped.length>0 for mortgage/loan, or at least one extracted field for purchase/rental). Skip caching empty results so a re-upload of the same file re-invokes the model.

### R4 · [med] Owner utilities from ALL contracts summed into fixedExpenses when there is no active lease
- **איפה:** src/pages/dashboard/HomeScreen.tsx:92-94 (monthlyOwnerUtilities)
- **הבעיה:** monthlyOwnerUtilities filters `u.payer === 'owner' && (u.amount ?? 0) > 0 && (!activeContractId || u.contract_id === activeContractId)`. usePropertyData fetches contract_utilities for EVERY contract of the property (`.in('contract_id', nextContracts.map(...))`), so `utilities` spans all historical contracts. When there is no active contract, `activeContractId` is undefined, so `!activeContractId` is true and the contract filter is bypassed — every owner-paid utility row across all past contracts is summed into fixedExpenses. With multiple historical leases each carrying owner-paid ארנונה/חשמל/etc., the 'תשלומים קבועים' line and the 'צפי לסוף החודש' headline are inflated (counted once per old contract). Trigger: a property with ≥2 past contracts that had owner-paid utilities and no currently-active lease.
- **תיקון מומלץ:** When there is no active contract, owner utilities should not be aggregated at all (no lease = the prior tenants' utility config is irrelevant). Change the filter so that an undefined activeContractId yields 0 rather than 'all contracts': `.filter(u => u.payer === 'owner' && (u.amount ?? 0) > 0 && !!activeContractId && u.contract_id === activeContractId)`. This keeps the active-lease case identical and only fixes the no-lease over-count.

### R5 · [med] Optimistic edit that changes a transaction's date to another month leaves it stale in the current month
- **איפה:** src/pages/finances/FinancesV2.tsx submitForm() lines 309-318 (optimistic merge at 313, persist-without-refetch at 316)
- **הבעיה:** On edit, the row is merged into local `transactions` state and the drawer closes; the background `updateTransaction(...)` only calls refetch() on ERROR. The month view never re-filters `transactions` by date (it renders/totals every row in state, relying on the query scope — see lines 144-145, 514). So if a family member edits a transaction's date to a different month (the date field at line 547 allows this), the persisted row now belongs to another month but stays visible in — and counted into the totals of — the currently displayed month until a manual refetch (e.g. switching tabs/months). Income/expense/net and the breakdown are silently wrong for both the old and new month.
- **תיקון מומלץ:** After a successful edit, if the persisted date falls outside the active scope, drop the row from local state — or simply call refetch() in the success branch of the .then() (mirroring the create path which already refetch()es). Cheapest correct fix: `updateTransaction(id, payload).then(({ error }) => { if (error) { refetch(); showFlash('העדכון נכשל — שוחזר','err') } else if (payload.date !== originalDate) refetch() })`, capturing the row's original date before the merge.

### R6 · [med] Attaching a receipt in the edit drawer fails silently (incl. oversized files)
- **איפה:** src/pages/finances/FinancesV2.tsx attachReceipt() lines 277-288 (catch at 286)
- **הבעיה:** Unlike ExpenseSheet (which surfaces upload failures and rejects files over MAX_UPLOAD_BYTES with a clear message), the edit-drawer attach path catches every error and does nothing user-visible — the spinner just stops. A family member who picks a large HEIC/photo (uploadDocument→assertSize throws for >15MB) or hits any storage/insert error sees the '+ צרף מסמך' button return to idle with no document added and no explanation, and assumes it worked. There is also no up-front size check here.
- **תיקון מומלץ:** In the catch, surface a flash, e.g. `catch { showFlash('צירוף המסמך נכשל — נסו שוב','err') }`, and add an up-front size guard before upload: `if (file.size > MAX_UPLOAD_BYTES) { showFlash('הקובץ גדול מדי (עד 15MB)','err'); return }` (import MAX_UPLOAD_BYTES from lib/storage, already imported nearby).

### R7 · [low] Overlapping active contracts: one real rent transaction suppresses ALL projected rent that month
- **איפה:** src/pages/finances/FinancesV2.tsx lines 136-142 (and the identical logic in the year memo 163-169 and range memo 202-208)
- **הבעיה:** De-dup matches on direction+category only: `realRentExists` is a single boolean over the whole month. If two contracts are active in the same month (overlapping leases, e.g. handover month) and the user records the real rent for ONE of them, the filter at line 139 drops EVERY projected rent entry for that month, so the second contract's expected rent silently vanishes from income/net/forecast. Same shape applies to the year and range aggregations.
- **תיקון מומלץ:** Scope the suppression per contract rather than globally — suppress a virtual rent entry only when a real rent transaction exists that matches that contract (e.g. carry contract_id on the virtual entry and on the real row, or fall back to matching amount/payee) instead of a blanket `realRentExists`. Given single-property/single-active-lease is the common case, mark for human review rather than auto-applying.

### R8 · [med] Editing a prime/variable mortgage track silently wipes prime_rate & margin
- **איפה:** src/pages/liabilities/LiabilitiesV2.tsx save() lines 258-263 (calls upsertMortgageTrack without prime_rate/margin); mortgage drawer JSX lines 449-465 has no anchor/margin inputs
- **הבעיה:** A prime or variable track is stored with prime_rate (anchor) + margin (can be negative 'prime minus') plus the folded effective annual_rate. The mortgage drawer only renders a single 'ריבית %' field and save() never passes prime_rate/margin to upsertMortgageTrack. upsertMortgageTrack's UPDATE always writes `prime_rate: data.prime_rate ?? null` / `margin: data.margin ?? null` (useMortgageData.ts lines 116-117). So any time a user opens an existing prime/variable track in the editor and saves (e.g. just to fix the principal), both prime_rate and margin are overwritten to null. The effective annual_rate is preserved so the Shpitzer math/schedule is unaffected, but the stored anchor/margin breakdown is permanently lost — and a track imported via the AI scan with a 'prime minus' structure loses its components after the first edit.
- **תיקון מומלץ:** Either (a) add anchor/margin inputs to the mortgage drawer for prime/variable track_type (mirroring the loan form lines 479-483) and pass them through in save(), or (b) at minimum preserve existing values: in save() pass `prime_rate: editId ? (existing track's prime_rate) : null` and same for margin, i.e. don't blank them when the form has no field to edit them. Simplest non-destructive fix: carry the original track's prime_rate/margin into tForm on editTrack and pass them in save().

### R9 · [low] Displayed 'monthly payment' overstates the real payment while a track is in its grace period
- **איפה:** src/hooks/useMortgageData.ts line 72 (summary.monthlyPayment) and src/pages/liabilities/LiabilitiesV2.tsx line 87 / hero line 321; src/pages/wealth/FinancingStructure.tsx line 74
- **הבעיה:** summary.monthlyPayment sums monthlyPayment(principal, rate, term, grace) for every track, which is the POST-grace Shpitzer payment (amortizes full principal over the remaining term). When a track is currently within its grace_months, the actual amount paid this month is interest-only (smaller), but the 'תשלום חודשי' figure in the liabilities hero, the combined Wealth monthly, and FinancingStructure all show the larger post-grace number. A user in a 12-month grace period sees a monthly payment that does not match what their bank actually charges. The codebase already has gracePeriodPayment() in mortgage.ts (lines 112-121) computing the correct grace-period total, but it is never used in the summary.
- **תיקון מומלץ:** In useMortgageData.ts compute monthlyPayment as the actual due amount for the current month: for each track find this month's scheduled row (trackSchedule(t).find by current YYYY-MM) and sum row.payment; fall back to the post-grace monthlyPayment only when no current row exists. Or use gracePeriodPayment(tracks) when any track is still in grace.

### R10 · [low] Scanned mortgage/loan drafts bypass the grace<term validation enforced on manual save
- **איפה:** src/pages/liabilities/LiabilitiesV2.tsx saveScannedDrafts() lines 153-193 vs manual save() lines 256 & 270; gate logic in ScanReview.tsx issues() lines 17-26
- **הבעיה:** Manual save() rejects grace_months >= term_months ('תקופת הגרייס חייבת להיות קצרה מהתקופה הכוללת'). The ScanReview completeness gate (issues()) only checks principal>0, term>0, rate>0 — it never checks grace vs term. saveScannedDrafts() then persists grace_months straight from the AI draft (lines 165 & 181). If the AI extracts grace_months >= term_months, the draft passes the gate and is saved. The amortization math clamps grace to term-1 (mortgage.ts line 21/44, loans.ts line 45) so there is no crash or zero-balance corruption — but the stored grace value is inconsistent with what the manual editor would have allowed, and the user is never warned.
- **תיקון מומלץ:** Add a grace>=term check to ScanReview.issues() for monthly rows (push 'גרייס' when num(d.grace_months) >= num(d.term_months)) so the gate blocks it, mirroring the manual validation; the scan review form would also need to surface the grace field for editing.

### R11 · [low] Turning off requires_approval silently ignores a failed rent-item delete
- **איפה:** src/hooks/useRecurringItems.ts:104-109 (syncRentRecurringItem, requires_approval=false branch)
- **הבעיה:** When a user edits a contract to set requires_approval=false, the function deletes the rent items but never checks the returned error: `await supabase.from('recurring_items').delete().in('id', ...)`. If that delete fails (RLS/network), the rent recurring item survives and keeps generating monthly 'גביית שכר דירה' approval tasks, while the contract card shows 'אוטומטי' — a silent state desync the user cannot see or correct from the UI. Contrast deleteRentRecurringItems() which deliberately throws on error for exactly this reason.
- **תיקון מומלץ:** Capture and throw on error in the off branch: `const { error } = await supabase.from('recurring_items').delete().in('id', rentItems.map(i => i.id)); if (error) throw error` so handleContractSave surfaces it via the form error state instead of silently leaving an orphaned approval item.

### R12 · [low] Documents scanned while creating a NEW contract are never linked to the saved contract
- **איפה:** src/pages/property/Rental.tsx:118-133 (persistScanFiles) + handleContractSave:344-385
- **הבעיה:** In persistScanFiles, contractId is null for a not-yet-saved new contract, so each scanned lease is stored with contract_id: null. After handleContractSave creates the contract (line 367) there is no step that back-links the session docs to the new contract id. The contract_id linkage the code intends to maintain (and explicitly sets when editing) is therefore permanently null for docs uploaded during new-contract creation. No data loss (they still appear in the global rental_contract list filtered by type), but any future per-contract document query/cleanup keyed on contract_id will miss them.
- **תיקון מומלץ:** After createContract returns the new id in handleContractSave, update the session docs' contract_id (e.g. pass a callback into ContractForm, or have onSave return the new contractId and call updateDocument on each sessionDocId with { contract_id }). Note updateDocument currently only allows name/type/date fields, so its Pick type would need contract_id added.

### R13 · [med] GENERATION_KEY in localStorage is not per-user — second account on a shared browser skips its monthly generation
- **איפה:** src/hooks/useMonthlyGeneration.ts:6,32,42 + src/contexts/AuthContext.tsx signOut() (line 94)
- **הבעיה:** The idempotency guard uses a global localStorage key 'monthly_generation' set to e.g. '2026-6' with no user namespace. In the family release a browser/device can be shared. If user A signs in and generation runs (key='2026-6'), then signs out and user B signs in the same month, useMonthlyGeneration reads localStorage[GENERATION_KEY] === currentMonthKey() as true and returns immediately — so user B's recurring_items (rent collections, payments, renewal-alert tasks) are NEVER generated for that month. signOut() only calls clearQueryCache() + supabase.auth.signOut(); it does not remove GENERATION_KEY, and nothing clears it on a different-user SIGNED_IN. Generation is per-owner (runGeneration filters by owner_id), but the skip-guard is global, so the two get conflated.
- **תיקון מומלץ:** Namespace the key by user id: build it as `monthly_generation:${userId}` inside the hook (read the user from useAuth/session before the localStorage check), or clear GENERATION_KEY in AuthContext.signOut() and on SIGNED_IN. Namespacing is the cleaner fix and keeps the per-month skip working per account.

### R14 · [med] resetAllData ignores every delete error and reloads anyway → partial/inconsistent wipe
- **איפה:** src/pages/Settings.tsx:133-167 (resetAllData)
- **הבעיה:** Each `await supabase.from(...).delete()` discards its `{ error }` result; only an actual thrown exception hits the catch (Supabase .delete() resolves with an error object rather than throwing). If e.g. the `transactions` delete is blocked by RLS or a FK, the code silently continues deleting the rest and then `window.location.reload()` runs, leaving the account in a half-reset state with no warning. Also the storage `.remove(...)` result is unchecked, so orphaned storage objects can remain. Gated to dev/admin (showDevTools), so blast radius is limited, but it is a real correctness gap in the reset flow.
- **תיקון מומלץ:** Capture and check each `{ error }`; on the first error, stop, call showStatus with the message, set resetting/confirmReset false, and do NOT reload. Run the deletes and only reload once all succeed (consider a single RPC/transaction for true atomicity).

### R15 · [high] Push reminders leak to the wrong family member on a shared device
- **איפה:** src/lib/push.ts:96-108 (ensurePushFresh) + src/contexts/AuthContext.tsx:94-96 (signOut) + src/lib/push.ts:74-86 (enablePush upsert)
- **הבעיה:** On a shared browser/PWA (the family release ships one account per family member), member A enables push: push_subscriptions gets a row (owner_id=A, endpoint=X). signOut() never calls disablePush() and never unsubscribes, so the browser subscription and the (A,endpoint=X) row survive. Member B then signs in; Layout runs ensurePushFresh(B.id), which calls reg.pushManager.getSubscription(), sees the still-live subscription X, hits `if (sub) return`, and does NOT re-upsert owner_id. The push_subscriptions row still maps endpoint X to owner A. The daily-reminders function therefore sends A's reminders (A's leases, tasks, payees — private financial data) to B's device, and B receives none of their own. It is silent: Settings.refreshPushState() sees permission 'granted' + isSubscribed()===true, shows pushState 'granted' ('on'), so B never re-toggles and never re-keys the endpoint. Persists until B manually disables and re-enables push.
- **תיקון מומלץ:** In ensurePushFresh, when getSubscription() returns a live sub, still re-upsert the row for the current ownerId (re-claim endpoint X for the logged-in user): sub.toJSON() + supabase.from('push_subscriptions').upsert({owner_id: ownerId, endpoint: sub.endpoint, p256dh, auth, last_seen_at}, {onConflict:'endpoint'}) instead of the bare `if (sub) return`. This re-keys the endpoint to whoever is currently signed in on every app open. (Optionally also call disablePush() in signOut, but re-keying on open is the robust fix since permission persists.)

### R16 · [low] Transient contracts-query error mis-fires the 'no active lease' nudge
- **איפה:** supabase/functions/daily-reminders/index.ts:133-159
- **הבעיה:** The liveContracts query result is used as `(liveContracts ?? [])`. If the contracts select errors (returns data:null), it is coerced to [] and section 2b treats the owner as having NO active/upcoming lease, then (if they own a property and cadence is due) pushes 'אין חוזה שכירות פעיל — מומלץ להוסיף שוכר חדש' — a wrong nudge for a user who actually has a live contract. Same null-as-empty coercion would also suppress a real renewal reminder for that run.
- **תיקון מומלץ:** Destructure the error and skip the lease sections on failure: `const { data: liveContracts, error: lcErr } = await ...; if (lcErr) { /* skip 2a/2b this run */ }`. Only evaluate the no-lease branch when the query succeeded.
