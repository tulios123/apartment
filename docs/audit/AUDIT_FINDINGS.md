# AUDIT_FINDINGS.md — running ledger (night run 17.07 + cloud continuation 18.07)

Appended per stage, deduped against KNOWN_ISSUES_BASELINE.md and prior stages. Status: FIXED(commit) / IMPROVED / PARKED / BLOCKED / OPEN.

## Run of 16–17.07 (stages 0–1)
| id | sev | area | finding | status |
|---|---|---|---|---|
| AUD-001 | P1 | onboarding | Finish (סיימו עכשיו / insurance סיום) folded a half-filled open track/loan form into the save with fabricated defaults (term→360, rate→5) — root of KNOWN R1/R2 | **FIXED** (finish runs the step completeness gate + חסרים-פרטים dialog) |
| AUD-002 | P2 | layout | Home no-lease empty-state CTA rendered under the fixed bottom-nav | **FIXED** (.main-content bottom padding) |
| AUD-003 | P3 | a11y | Touch targets < 44pt (6 flagged controls) | **FIXED** (owner approved uniform 44pt floor 18.07) |
| AUD-004 | P2 | code/console | DevNotes setState-in-render warning + recurring `TypeError: Load failed` on onboarding→app | **FIXED 18.07** (DevNotes: history-patch sync deferred one tick — verified 0 warnings across full nav sweep; Load-failed = WebKit's abort message for fetches cut by the full-page reload the re-entry uses — benign, 0 Chromium console errors all session) |
| SW-05 | P3 | config | vitest picked up e2e specs | **FIXED** (vite.config test.exclude) |
| AUD-006 | P1 | onboarding | Term "0"/negative passed every gate, silently saved as 360 | **FIXED** (shared validation.ts gate) |
| AUD-007 | P3 | onboarding | Untouched empty track form always raised "חסרים פרטים" | **FIXED** (raw-typed-fields check) |
| AUD-008 | P3 | onboarding | Grace ≥ term saved as typed while the engine clamps | **FIXED** (clamped at save) |
| AUD-009 | P3 | onboarding | Rent-0 contract / empty policy junk rows | **FIXED** (positive-rent gate; policy needs company or premium) |

## Cloud continuation run 18.07 (stages 2–7) — new findings
| id | sev | area | finding | status |
|---|---|---|---|---|
| AUD-010 | P2 | money/UI | Ghost double-tap on "כן, אשר" (approve rent) entered approveRent twice before the disabled re-render → TWO identical rent transactions inserted (reproduced live: created=2) | **FIXED** (ec-series commit a401d4c: synchronous reentry guard `lib/reentryGuard.ts`, same hole finishingRef plugs; live triple-tap → exactly 1 tx; 4 unit tests) |
| AUD-011 | P2 | resilience | Network-level failure at boot (offline/reset) REJECTS the supabase promise instead of returning `{error}` — the thrown rejection escaped the C3 retry ladder → user trapped on infinite splash (reproduced: 20s+, no retry screen) | **FIXED** (92f73c1: `lib/bootCheck.probeHasProperty` folds both failure shapes; live: retry screen at ~38s + "נסו שוב" recovers; 4 unit tests). NOTE: the 38s is supabase-js internal retries (~7s/call) × the 4-attempt ladder — shortening is an owner call |
| AUD-012 | P3 | a11y | Stage-2 sweep: 23 interactive controls under the 44pt floor beyond AUD-003's list (view/segment toggles 33px, sheet save 43px, datefield 41px, wealth edit 35px/24px, binder edit 32px, tasks quick-add 40px, doc chips 42px, settings back 36px, theme toggles 35px, btn-primary/secondary 39-41px, home hs-btn 38px) | **FIXED** (27c9512: invisible ::after hit-floor, zero visual change — post-fix sweep clean). Accepted exceptions: finv-bd-rows 27→37px (gap-bounded — full 44 needs taller rows, design call) and year-chart bars (essential) |
| AUD-013 | P3 | resilience | TasksV2 attach: empty catch swallowed upload failures (spinner→idle, task silently unchanged), no size guard — unlike hardened siblings (EDGE-17) | **FIXED** (ec6374b: size guard + surfaced error; live-verified) |
| OBS-001 | — | a11y-tree | Collapsed breakdown accordion keeps opacity-0 rows in the accessibility tree (max-height/opacity, no visibility toggle). Clipped + unclickable, so no user impact; screen-reader noise only | OPEN (low) |
| OBS-002 | — | code | Both header buttons of BottomSheet (lightbulb + X) share the class `.bsheet-close` — confusing for tests/tooling | OPEN (naming only) |
| OBS-003 | — | data | Baseline account carries virtual insurance rows back to 1.1.2024 (policy start) — by design, but makes the "empty month" state unreachable on this account | not-a-bug (noted) |

## Legacy-findings verdicts (task 6 — file:line evidence via code verification agents)
| finding | verdict | evidence |
|---|---|---|
| R7 overlapping-contracts rent | **STILL-OPEN (P3, edge)** | projections.ts:125-136 — monthlyVirtualEntries emits a virtual rent row per overlapping contract (no ledger dedup; N6's newest-wins dedup lives only in rentReceivedToDate:56-79); FinancesV2.tsx:143,149-155 — `realRentExists` is month-wide, so ONE real rent tx suppresses ALL contracts' virtual rows. Single-apartment design makes this a rare edge; fix touches money paths → prepare-only (see PREPARED addendum below) |
| R4 utilities from all contracts | **FIXED-IN-PASSING** | forecast totals now derive solely from monthlyVirtualEntries (HomeScreen.tsx:106-111), which emits no utility rows (projections.ts:101-196); no utility summation exists anywhere. Stale comment corrected 18.07 |
| DSR-b4 useInvestmentData swallows errors | **FIXED (verified)** | useInvestmentData.ts:44-58 — all five queries' `.error` checked and thrown → setError; cache write skipped on failure |
| NIGHT08-push-optout | **FIXED (verified)** | push.ts:54-57,96,111,149-150 — persisted `push_opt_out:<ownerId>`, ensurePushFresh bails, enable clears; Settings passes user.id |
| NIGHT08-drawer-rtl | **OBSOLETE/FIXED** | tx editor is a body-portaled BottomSheet (FinancesV2.tsx:624); no left:0 drawer remains |
| NIGHT08-wealth-colors | **NOT-A-BUG** | raw hexes live only inside the fixed-navy hero (wealth.css:10,21-30) which intentionally stays dark in both themes; all other wealth charts use theme tokens with dark overrides |
| NIGHT08-renewal-idempotency | **FIXED (verified)** | useMonthlyGeneration.ts:192-201 — open-renewal existence check before insert |
| NIGHT08-renewal-alert-days | **STILL-OPEN (P3)** | renewal_alert_days selected (useMonthlyGeneration.ts:174) but never read — RENEWAL_WINDOW_DAYS=60 hardcoded (constants.ts:12); edge function daily-reminders also hardcodes 60. Fix spans an edge function → 🔴 owner |
| NIGHT08-task-category-lost | split | spawnNextOccurrence carries category (useTasks.ts:111) — that path FIXED. BUT generated approval tasks are always category 'כללי' (useMonthlyGeneration.ts:155), so a recurring-repair task's completion follow-up degrades to 'אחר' — prepared one-liner below, 🔴 (generation writes for all accounts) |
| NIGHT08-focuswithin-delete | **FIXED 18.07** | documents-v2.css:20 + tasks-v2.css:53 — :focus-within added alongside :hover |
| NIGHT08-insurance-truncate | **FIXED-IN-PASSING** | .contract-company ellipsis (index.css:1117-1124) + min-width:0 container; insurer span wraps |
| NIGHT08-numpad-rtl / golden #4 | **FIXED 18.07** | ExpenseSheet KEYS reordered [.,0,⌫] + .numpad direction:ltr — live-verified rows "1 2 3 / 4 5 6 / 7 8 9 / . 0 ⌫", typing works |
| NIGHT08-welcome-skip | **STILL-OPEN (copy)** | WelcomeStep.tsx:31 promises "אפשר לדלג בכל שלב" but PurchaseStep has no skip (by design — property is the mandatory minimum). Suggest softening the promise in the pending voice pass (golden #2) → owner |
| NIGHT08-tx-race | STILL-OPEN (deferred) | fast month-switch race — the SW-12 cancellation plan (PREPARED_SW12_SW06.md) is the fix vehicle |
| Group-ה "14 findings" | **verified by file** | The 14 were never enumerated (their verify agents died on quota before writing them — night-review-2026-07-08.md:80-83). All ten named files verified against current code instead: AuthContext ✔ hardened · push.ts ✔ · format.ts ✔ (UTC class resolved) · quickParse ✔ · taskFollowup ✔ (residual = the generation category item above) · extractFinancing ✔ (client) · screenLabel ✔ · editContext ✔ · TasksV2 → attach hole found & FIXED (AUD-013) · ExpenseSheet → numpad found & FIXED |

## Prepared-only addendum (🔴 — not executed)
- **R7 (two changes, both money-path):** (a) apply the rentReceivedToDate newest-contract-wins dedup inside monthlyVirtualEntries so overlapping contracts project one rent row per month; (b) suppress virtual rent per-contract (match the real tx's contract_id / newest) instead of the month-wide `realRentExists` boolean. Both need Stage-1-style money re-verification after.
- **Generated-task category:** useMonthlyGeneration.ts:155 — `category: item.category === MAINTENANCE_CATEGORY ? 'תיקונים ותחזוקה' : 'כללי'` so repair follow-ups keep working; decide the mapping for other categories first.
- **SW-12 / SW-06:** docs/audit/PREPARED_SW12_SW06.md.

## Static-sweep backlog — resolution 18.07
SW-07 ✔ (formatNum re-export + formatPrice delegate; wizard formatCurrency stays local by design) · SW-08 ✔ (4 reimpls → lib/format.monthDayISO) · SW-11 ✔ (isManager gate) · SW-17/18/19 ✔ (SHEET_CLOSE_MS, MOCK_SCAN_DELAY_MS) · SW-21 ✔ (TRACK_LABELS/COLORS/BADGES in constants) · SW-12/SW-06 prepared-only. eslint errors 15→15 (baseline preserved; HomeScreen −1).
