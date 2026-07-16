# AUDIT_FINDINGS.md — night run 17.07.2026 (running ledger)

Appended per stage, deduped against KNOWN_ISSUES_BASELINE.md and prior stages. Status: FIXED(commit) / IMPROVED / PARKED / BLOCKED / OPEN.

| id | sev | area | finding | status |
|---|---|---|---|---|
| AUD-001 | P1 | onboarding | Finish (סיימו עכשיו / insurance סיום) folded a half-filled open track/loan form into the save with fabricated defaults (term→360, rate→5) — root of KNOWN R1/R2 | **FIXED** (commit on staging: finish runs the step completeness gate + raises חסרים-פרטים dialog; handleFinish only folds gate-passing drafts; untouched forms skip via raw-field hasData) |
| AUD-002 | P2 | layout | Home no-lease empty-state CTA ("הוסיפו חוזה") rendered under the fixed bottom-nav (padding assumed 56px nav vs real ~64px) | **FIXED** (commit on staging: bumped .main-content bottom padding; verified 0 nav-overlaps at max-scroll, 4 hubs × 2 themes) |
| AUD-003 | P3 | a11y | Touch targets < 44pt: .finv-monthnav-btn 34×34, .hs-quick-go 38×38, account-menu back 38×38, .usermenu-avatar 49×34, .hs-link "פירוט" 32×16, .fb-fab 42×42 | OPEN (owner-triage: cross-file, wants one consistent decision) |
| AUD-004 | P2 | code/console | DevNotes setState-in-render warning (dev/manager-only, not shipped to family) + recurring `TypeError: Load failed` (aborted fetch on onboarding→app nav) | OPEN (confirm Load-failed is benign nav-abort; DevNotes fix low-impact) |
| SW-05 | P3 | config | vitest picked up e2e Playwright specs and errored the run | **FIXED** (commit on staging: vite.config test.exclude e2e/scripts) |

## Static-sweep backlog (subagent, not yet actioned — for owner/next-continue)
SW-06 single 1.04MB JS chunk (code-split hubs) · SW-07 onboarding forked format.ts helpers · SW-08 four private monthDayISO reimpls · SW-11 duplicate MANAGER_EMAIL constant · SW-12 data hooks lack fetch-cancellation (setState-after-unmount risk) · SW-21 track-color palette defined in 4 places · SW-17/18/19 copy-pasted mock-delay/close-anim magic numbers. eslint: 28 errors, mostly react-hooks/refs on the intentional discard-guard snapshot pattern (React-Compiler backlog, not bugs).

## KNOWN rechecks still owed (from baseline priority list)
R7 (overlapping-contracts rent suppression) · DSR-b4 (useInvestmentData swallows fetch errors) · NIGHT08-push-optout · R4 (refactored HomeScreen) · NIGHT08-drawer-rtl · NIGHT08-wealth-colors. These need the Stage-1 live/seeded pass to confirm.
