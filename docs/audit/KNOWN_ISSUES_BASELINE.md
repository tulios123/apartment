# KNOWN_ISSUES_BASELINE — dedup reference for the night run (built Stage 0, from repo audit docs)

Findings tonight are deduped against this table: a match = mark KNOWN(id), don't re-report. Statuses: OPEN / FIXED / PENDING-OWNER / STALE.

| id | source-doc | description | status |
|---|---|---|---|
| C1 | 01_CRITICAL_BUGS, fixes_log | Feedback admin RLS hardcoded email vs UI gate mismatch (migration 031) | FIXED |
| C2 | 01_CRITICAL_BUGS, fixes_log | Onboarding wizard state pure in-memory — interruption lost progress | FIXED |
| C3 | 01_CRITICAL_BUGS, fixes_log | Cold-start properties query error routed existing user to Onboarding → dup property | FIXED |
| C4 | 01_CRITICAL_BUGS, fixes_log | No React error boundary — render exception white-screened app | FIXED |
| C5 | 01_CRITICAL_BUGS, fixes_log | Offline/failed task completion still fired money follow-up confirm() | FIXED |
| C6 | 01_CRITICAL_BUGS, fixes_log | Daily push listed same approval item twice | FIXED |
| C7 | 01_CRITICAL_BUGS, fixes_log | Silent failures: receipt attach swallowed; dashboard query errors zeroed out | FIXED |
| C8 | 01_CRITICAL_BUGS, fixes_log | Home forecast double-counted loan/owner-utility payments | FIXED |
| SEC-anon | 01_CRITICAL_BUGS, QA, rls-audit-07-07 | Historical anon-key full-access RLS policies | FIXED (live-verified anon=0) |
| EDGE-01..04 | 02_EDGE_CASES, fixes_log | UTC off-by-one cluster (renewal daysLeft ×2, projections parsing, formatDate) | FIXED |
| EDGE-05 | 02_EDGE_CASES | rentReceivedToDate full month on day 1 of lease | STALE (intentional) |
| EDGE-06 | 02_EDGE_CASES | Month rollover while app open doesn't re-scope until remount | OPEN (deferred, low) |
| EDGE-07 | 02_EDGE_CASES, fixes_log | Monthly-generation cross-device TOCTOU race | FIXED (migration 032) |
| EDGE-08 | 02_EDGE_CASES, fixes_log | SW→app navigation lost if listener unmounted | FIXED |
| EDGE-09 | 02_EDGE_CASES, fixes_log | daily-reminders approval nag un-throttled | FIXED (dedup); cadence intentional |
| EDGE-10 | 02_EDGE_CASES | push_log release races on same-day retry | OPEN (accepted) |
| EDGE-11 | 02_EDGE_CASES, fixes_log | No pushsubscriptionchange handler | FIXED |
| EDGE-12 | 02_EDGE_CASES, fixes_log | grace_months >= term_months not validated | FIXED |
| EDGE-13 | 02_EDGE_CASES, fixes_log | Negative effective rate could go net-negative | FIXED |
| EDGE-14 | 02_EDGE_CASES, fixes_log | Floating-point money comparisons unguarded | FIXED |
| EDGE-15 | 02_EDGE_CASES | combineSchedules O(dates×tracks×rows) cost | OPEN (fine at family scale) |
| EDGE-16..19, 23, 26 | 02_EDGE_CASES, fixes_log | numpad backspace, file size/type ceiling, extensionless files, quickParse income words, NaN guards, missing env crash | FIXED |
| EDGE-24 | 02_EDGE_CASES | ensureOwnerRow not awaited on warm-session path (FK race) | OPEN (low) |
| EDGE-25 | 02_EDGE_CASES | Stale local session on write could hit RLS with expired JWT | OPEN (low) |
| UX-01..05 | 03_UX_FRICTION, fixes_log | keyboard trap, scrim-discard, native confirm/alert, focus trap | FIXED |
| UX-06 | 03_UX_FRICTION | Tap targets/safe-area pixel measurement | OPEN (tonight's Stage 2 covers) |
| UX-07/QA-14 | 03_UX_FRICTION | No offline cache/shell (banner exists) | OPEN (future by design) |
| UX-08 | 03_UX_FRICTION | Write-failure recovery inconsistent | FIXED (substantially) |
| UX-09 | 03_UX_FRICTION | Splash can hang up to 5s on data hooks | OPEN (perf note) |
| UX-10 | 03_UX_FRICTION | HomeScreen mounts 7 independent fetch hooks | OPEN (scale-watch) |
| UX-11 | 03_UX_FRICTION | BottomSheet keyboard-inset recompute churn | OPEN (no jank observed) |
| UX-12 | 03_UX_FRICTION | Whole-table unbounded fetches | OPEN (fine at family scale) |
| UX-13 | 03_UX_FRICTION | "N פעולות" counts renewals unbounded while tasks capped | OPEN (minor) |
| UX-14 | 03_UX_FRICTION, fixes_log | Stale baked-in "נותרו X ימים" in task title | FIXED |
| UX-15 | 03_UX_FRICTION | formatCurrency hides agorot — sublists may not visibly sum | OPEN (low) |
| UX-16 | 03_UX_FRICTION | No upload-progress indicator on receipt attach | OPEN (low) |
| UX-17 | 03_UX_FRICTION, fixes_log | Onboarding resume affordance | FIXED (badge polish deferred) |
| UX-18 | 03_UX_FRICTION | Per-step uploaded-files toggle clarity | OPEN (device pass) |
| BUG-1,2,8,9,10 | QA_MASTER_CHECKLIST | interestToDate UTC; systemic toISOString().slice; activeContract skew; day 29-31 invalid dates; day>28 clamp | FIXED |
| QA-2.2a | QA, deep-state-review | recurring_items.contract_id SET NULL not CASCADE | PENDING-OWNER (schema) |
| QA-1.0 | QA, ROADMAP | CPI/הצמדה not modelled (nominal-only) | PENDING-OWNER (product) |
| QA-1.0b | QA | Partial prepayments unsupported | OPEN (future feature) |
| B-01 | UX_REVIEW, DESIGN_REVIEW | Entire pre-4-pillar IA critique | STALE (screens no longer exist) |
| B-02/B-03 | DESIGN_REVIEW | tokens/tabular-nums/dark-mode items | FIXED (per doc's own log) |
| B-04..06 | DESIGN_REVIEW | icon-weight consolidation; blur-time validation; desktop width | OPEN (explicitly deferred) |
| RLS-storage-update | rls-audit-07-07 | No UPDATE policy on storage.objects | OPEN (hardening, not a leak) |
| RLS-admin-email | rls-audit-07-07 | Feedback admin gated by JWT email not UID | OPEN (hardening) |
| FAM-numeric-coercion | family-release-review | numeric-as-string `+` concatenation in money math | FIXED (a2bb213) |
| EXTRACT-ratelimit | overnight-07-07, ROADMAP | Per-owner rate limiting on extract-* fns | FIXED (migration 047, deployed) |
| EXTRACT-media-validation / V1-edge | extract-hardening, _overnight_log | media_type unvalidated → 500 not 400 | FIXED |
| DATE-EDGE-fix | overnight-07-07 | rentReceived 13-month count; addMonths day-31 rollover; equity walk | FIXED |
| ONBOARD-atomicity | night-review-07-08, ROADMAP | handleFinish cleared draft on partial write failure | FIXED (residual: Promise.all partial-landing on retry; savedRef not persisted) |
| **R1** | _overnight_log, deep-state-review | **Unsaved new loan bypasses onboarding gate, written malformed (rate 0/term null)** | **OPEN — recheck tonight** |
| **R2** | _overnight_log, deep-state-review | **Unsaved new mortgage track bypasses gate, saved with fabricated defaults** | **OPEN — recheck tonight** |
| R3 | _overnight_log, ROADMAP | Empty extraction result cached, blocks re-extraction | FIXED |
| R4 | _overnight_log, deep-state-review | Owner utilities from ALL contracts summed when no active lease | FIXED per ROADMAP — code refactored since, re-verify |
| R5, R6, R8..R16 | _overnight_log, ROADMAP waves | (optimistic edit staleness; silent receipt fail; prime wipe; grace overstate; scan bypass validation; approval-off silent fail; contract-doc backlink; generation key per-user; reset partial wipe; push re-key; contracts-error nudge) | FIXED |
| **R7** | _overnight_log | **Overlapping active contracts: one real rent tx suppresses ALL projected rent that month** | **OPEN (deferred to human review)** |
| N6, N7, N8 | _overnight_log, ROADMAP wave ג | rent dedup; loan-forecast suppression; interest schedule-over-manual | FIXED |
| W1, W2, W7 | _overnight_log, ROADMAP wave ג | grace/date-aware payment display cluster | FIXED |
| W4, W5, W6 | _overnight_log | equity% clamp; Google sign-in silent fail; tx edit nulls links | FIXED |
| V2, V3 | _overnight_log, ROADMAP wave א | push nag after approve; dead minimized-sheet FAB | FIXED |
| **DSR-b4** | deep-state-review | **useInvestmentData swallows tracks/contracts/loans fetch errors → silent wrong numbers** | **OPEN (likely) — recheck tonight** |
| DSR-verification-debt | deep-state-review group ה | 14 findings from 08.07 unverified (AuthContext, push.ts, format.ts, quickParse, taskFollowup, extractFinancing, screenLabel, editContext, TasksV2, ExpenseSheet) | PENDING-OWNER — re-discoveries = KNOWN |
| DSR-branch-numbering | deep-state-review | migration numbering collision on prepared branches | FIXED |
| **NIGHT08-push-optout** | night-review-07-08 | **Disabling push in Settings silently reverts (no persisted opt-out intent)** | **OPEN (likely) — recheck vs R15 fix** |
| NIGHT08-numpad-rtl | night-review-07-08, DESIGN_UX_REVIEW 2.15 | Numpad digits mirror-order vs standard keypad | OPEN — Stage 6 golden #4 fixes |
| NIGHT08-drawer-rtl | night-review-07-08 | Finances edit drawer enters from physical left (`left:0`) | OPEN — recheck |
| NIGHT08-welcome-skip | night-review-07-08 | Welcome promises "skip any step"; purchase step has no skip | OPEN |
| NIGHT08-wealth-hardcoded-colors | night-review-07-08 | Wealth bar colors hardcoded hex, no dark adapt | OPEN (soft tokens exist now — re-verify) |
| NIGHT08-renewal-idempotency | night-review-07-08 | Renewal-task insert lacks idempotency guard | OPEN |
| NIGHT08-renewal-alert-days-ignored | night-review-07-08 | renewal_alert_days fetched but ignored (hardcoded 60) | OPEN |
| NIGHT08-task-category-lost | night-review-07-08 | Recurring repair task loses category → follow-up 'אחר' | OPEN |
| NIGHT08-tx-race | night-review-07-08 | Fast month-switch race shows wrong month briefly | OPEN (deferred refactor) |
| NIGHT08-focuswithin-delete | night-review-07-08 | Delete button opacity:0 needs :focus-within too | OPEN |
| NIGHT08-insurance-name-truncate | night-review-07-08 | Long insurer-name truncation subtle | OPEN (very low) |
| PRIVACY-live-verify | deep-state-review, ROADMAP desk 1 | Live privacy re-verification (3 SQL queries) after migrations 038-046 | PENDING-OWNER |
| DOCS-family-real | ROADMAP desk 3 | Real family documents extraction test | PENDING-OWNER |
| DOCS-stale-handoff | ROADMAP | docs/handoff stale | OPEN |
| MISC-admin-route | ROADMAP | ?admin=1 removal (owner still uses) | PENDING-OWNER |
| MISC-hebrew-errors | ROADMAP | Server 400s not fully Hebrew client-side | OPEN 🟢 |
| PROD-* | ROADMAP | tax report / renewal hub / CPI disclosure / EN toggle / simulator / real values / month-close | OPEN (future features, not bugs) |

## Notes
- UX_REVIEW.md + DESIGN_REVIEW.md = historical (pre-4-pillar IA); only token-level notes carried forward (done).
- QA_MASTER_CHECKLIST.md marked to-be-archived in ROADMAP; bug list inside all FIXED.
- Owner desk (ROADMAP): privacy live-verify · next publish (contract-retry guard + sheet-close improvements in testing app) · real family docs.
- Priority rechecks tonight: **R1, R2, R7, DSR-b4, NIGHT08-push-optout, R4 (refactored code), NIGHT08-drawer-rtl, NIGHT08-wealth-colors**.
