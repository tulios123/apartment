# AUDIT_FINDINGS.md — night run 17.07.2026 (running ledger)

Appended per stage, deduped against KNOWN_ISSUES_BASELINE.md and prior stages. Status: FIXED(commit) / IMPROVED / PARKED / BLOCKED / OPEN.

| id | sev | area | finding | status |
|---|---|---|---|---|
| AUD-001 | P1 | onboarding | Finish (סיימו עכשיו / insurance סיום) folded a half-filled open track/loan form into the save with fabricated defaults (term→360, rate→5) — root of KNOWN R1/R2 | **FIXED** (commit on staging: finish runs the step completeness gate + raises חסרים-פרטים dialog; handleFinish only folds gate-passing drafts; untouched forms skip via raw-field hasData) |
| AUD-002 | P2 | layout | Home no-lease empty-state CTA ("הוסיפו חוזה") rendered under the fixed bottom-nav (padding assumed 56px nav vs real ~64px) | **FIXED** (commit on staging: bumped .main-content bottom padding; verified 0 nav-overlaps at max-scroll, 4 hubs × 2 themes) |
| AUD-003 | P3 | a11y | Touch targets < 44pt: .finv-monthnav-btn 34×34, .hs-quick-go 38×38, account-menu back 38×38, .usermenu-avatar 49×34, .hs-link "פירוט" 32×16, .fb-fab 42×42 | **FIXED** (owner approved a uniform 44pt floor 18.07; commit on staging: monthnav/quick-go/fab/composer-send/receipt-clear/legal-back sized to 44, hs-link + avatar get a ≥44 hit-box without visual change) |
| AUD-004 | P2 | code/console | DevNotes setState-in-render warning (dev/manager-only, not shipped to family) + recurring `TypeError: Load failed` (aborted fetch on onboarding→app nav) | OPEN (confirm Load-failed is benign nav-abort; DevNotes fix low-impact) |
| SW-05 | P3 | config | vitest picked up e2e Playwright specs and errored the run | **FIXED** (commit on staging: vite.config test.exclude e2e/scripts) |
| AUD-006 | P1 | onboarding | Owner-reported: a mortgage/loan term of "0" months (also negatives) passed EVERY completeness gate (string-truthiness `!term_months`), then was silently saved as 360 months (track) / no term (loan) — numbers the user never typed | **FIXED** (18.07: shared `validation.ts` gate — term must be a positive integer; the 4 drifting gate copies in the hook + both steps now import ONE definition; 12 unit tests incl. fails-before cases) |
| AUD-007 | P3 | onboarding | The mortgage step's "typed into" check counted the grey-placeholder rate default, so an untouched empty track form ALWAYS raised the "חסרים פרטים" dialog on המשך | **FIXED** (18.07: raw-typed-fields check, same semantics as the finish path's untouched-skip) |
| AUD-008 | P3 | onboarding | Grace ≥ term was saved as typed while the schedule engine clamps (EDGE-12) — stored track displayed one thing, amortized another | **FIXED** (18.07: grace clamped below term at save, for tracks and loans) |
| AUD-009 | P3 | onboarding | A rental contract could be created with rent "0" (seeding 0-rent forecast rows), and an insurance policy with premium "0" + no company saved as a junk row | **FIXED** (18.07: rent must be positive to create the contract — otherwise flagged, not dropped; a policy needs a company or a positive premium) |

## Static-sweep backlog (subagent, not yet actioned — for owner/next-continue)
SW-06 single 1.04MB JS chunk (code-split hubs) · SW-07 onboarding forked format.ts helpers · SW-08 four private monthDayISO reimpls · SW-11 duplicate MANAGER_EMAIL constant · SW-12 data hooks lack fetch-cancellation (setState-after-unmount risk) · SW-21 track-color palette defined in 4 places · SW-17/18/19 copy-pasted mock-delay/close-anim magic numbers. eslint: 28 errors, mostly react-hooks/refs on the intentional discard-guard snapshot pattern (React-Compiler backlog, not bugs).

## KNOWN rechecks still owed (from baseline priority list)
R7 (overlapping-contracts rent suppression) · DSR-b4 (useInvestmentData swallows fetch errors) · NIGHT08-push-optout · R4 (refactored HomeScreen) · NIGHT08-drawer-rtl · NIGHT08-wealth-colors. These need the Stage-1 live/seeded pass to confirm.
