# RUN_STATE.md — night run 16-17.07.2026 (machine clock unreliable; labels are machine time)

**Branch:** staging (commits go directly here; no checkout — shared working tree). **Run doc:** NIGHT_RUN.md (repo root).
**Counts:** found 4 · fixed 1 · improved 0 · parked 0 · KNOWN-deduped (baseline built)
**Last checkpoint commit:** (AUD-001 committing now)
**Next action:** Stage 1 core flows on the seeded dataset (seed first) + triage the S2 layout findings from the onboarding partial-data pass. Static-sweep report in hand.

## Findings ledger (live)
- **AUD-001** [FIXED] P1 · onboarding finish (סיימו עכשיו / insurance סיום) silently saved an incomplete open mortgage-track/loan form with FABRICATED defaults (term→360, rate→5) the user never entered — bypassing the step's own completeness gate. Fix: finish now runs the same gate → raises a "חסרים פרטים" dialog (חזרה להשלמה / המשך בלי לשמור), and handleFinish only folds a draft that passes the gate. Untouched forms still skip silently (raw-field hasData). Evidence: e2e/onboarding.spec.ts (2 specs fail-before/pass-after) + full-walk + untouched-skip. Root of KNOWN R1/R2. tsc+135 vitest+build green.
- **AUD-002** [OPEN P2 · S2] Layout: full-width bottom CTAs overlap the fixed bottom-nav on sparse states — HomeScreen `.hs-addlease` "הוסיפו שוכר" (64–90% overlap w/ nav) and PropertyAdmin `.btn-primary "+ חוזה חדש"` (37%). Auto-filed by layout-integrity pass on partial-data home/property. Needs bottom padding / safe-area above nav.
- **AUD-003** [OPEN P3 · S2] Touch targets < 44pt: `.finv-monthnav-btn` 34×34, `.hs-quick-go` 38×38, account-menu back 38×38, `.usermenu-avatar` 49×34 (h<44), `.hs-link "פירוט"` 32×16, `.fb-fab` 42×42. Multiple screens. Bump to 44pt floor.
- **AUD-004** [OPEN P2] Console: `DevNotes` setState-in-render warning ("Cannot update a component (DevNotes) while rendering BrowserRouter") + recurring `TypeError: Load failed` (aborted fetch on nav) during onboarding→app. DevNotes is dev/manager-only; Load-failed likely nav-aborted version/supabase fetch — confirm benign or add abort handling.

## Static-sweep report (subagent, retained)
tsc clean · 135 vitest green · build ok (single 1.04MB JS chunk — SW-06 code-split opportunity). Key items: SW-05 vitest picks up e2e specs (FIX applied: vite.config test.exclude); SW-07 onboarding forked its own format.ts copies; SW-08 four private monthDayISO reimpls; SW-11 dup MANAGER_EMAIL constant; SW-12 hooks lack fetch cancellation; SW-21 track-color palette defined in 4 places. eslint 28 errors (mostly react-hooks/refs on the discard-guard snapshot pattern — intentional, React-Compiler backlog). Full list in subagent output.

## Stages
| stage | title | status |
|---|---|---|
| 0 | Foundation & calibration | in-progress |
| 1 | Core functionality & financial correctness (live) | pending |
| 2 | Layout, UI & accessibility math | pending |
| 3 | Smoothness & perceived performance | pending |
| 4 | Resilience & stress | pending |
| 5 | Code quality & static checks | pending |
| 6 | Design golden list + approved product decisions | pending |
| 7 | Everything else until matrix closes | pending |
| 8 | Close-out (cleanup [E2E], AUDIT_FINDINGS statuses, MORNING_REPORT he, final state) | pending |

## Stage 0 checklist
- [x] Baseline docs read → KNOWN_ISSUES_BASELINE.md (subagent, saved)
- [x] PROMPT_REVIEW.md written (10 factual corrections applied, 4 checks added)
- [x] @playwright/test + webkit + chromium installed (allowed package.json edit)
- [x] playwright.config.ts + e2e/lib (login/archive/layout/console/network helpers)
- [x] Pre-flight gate PASSED: webkit iPhone16Pro reaches authed Home, dark boots, 0 console hits (e2e/preflight.spec.ts)
- [x] Admin data-reset PASSED on test account → onboarding shows clean (e2e/reset.spec.ts; evidence archived)
- [ ] Clean-account onboarding E2E (finish-early path + full walk + back-at-each-step) → empty states → seed
- [x] scripts/audit/seed-stress.ts + cleanup-stress.ts written (anon key + dev sign-in; both safety flags) — cleanup smoke-test before seed
- [x] UX_FOUNDATIONS lenses A–E (items 1–33) slotted as stage riders (F+ missing at source)

## Coverage matrix
Statuses per cell: `-` pending · `V` visited (evidence archived) · `U` unreachable(reason). Columns: light@402, dark@402, light@320, states covered.
| surface | L402 | D402 | L320 | states |
|---|---|---|---|---|
| Splash (cold start) | - | - | - | cold, safety-ceiling |
| Login (bypass-off server) | - | - | - | initial, error |
| Onboarding S1 ברוכים הבאים (fwd+back) | - | - | - | clean acct |
| Onboarding S2 רכישה (fwd+back) | - | - | - | clean, filled, back-preserves |
| Onboarding S3 משכנתא (fwd+back) | - | - | - | +unsaved-track gate (R2) |
| Onboarding S4 הלוואות (fwd+back) | - | - | - | +unsaved-loan gate (R1) |
| Onboarding S5 השקעה (fwd+back) | - | - | - | equity edge 0/100 |
| Onboarding S6 שכירות (fwd+back) | - | - | - | |
| Onboarding S7 ביטוח (fwd+back) | - | - | - | |
| Onboarding S8 מסמכים (fwd+back) | - | - | - | |
| Onboarding S9 סיום + "סיים עכשיו" mid-way | - | - | - | partial-data hubs render |
| Home | - | - | - | empty, loaded, stress, all-clear vs busy |
| Finances month | - | - | - | empty month, loaded, stress 400+ |
| Finances year | - | - | - | forecast bars |
| Finances range | - | - | - | |
| Finances expense sheet (keypad+details) | - | - | - | dirty-discard confirm |
| Finances tx drawer (edit) | - | - | - | receipt attach |
| Wealth main (hero/accelerator/structure/recovery/stats) | - | - | - | empty, loaded, stress |
| Wealth liabilities (LiabilitiesV2 + finance editor) | - | - | - | 6 tracks, grace, balloon |
| Scan review / doc list (ScanReview, ScanDocList) | - | - | - | code-level if no doc |
| Property hub: חוזה tab (+contract form) | - | - | - | active, ends-in-10d badge |
| Property hub: ביטוח tab (+policy form) | - | - | - | |
| Property hub: משימות tab (+task sheet) | - | - | - | empty, overdue/today/future/done |
| Property hub: מסמכים tab (+doc sheet) | - | - | - | checklist 3/6, collections |
| PropertyForm (edit property) | - | - | - | |
| Settings | - | - | - | manager tools visible/hidden |
| FeedbackAdmin (admin/feedback) | - | - | - | admin-only gate |
| Legal ×3 (public frame + in-app) | - | - | - | |
| Account menu popover | - | - | - | |
| Error screens (property-retry, root boundary) | - | - | - | forced error |
| Offline banner / Update banner | - | - | - | offline sim |
| Quick-capture (Home) | - | - | - | free text + both buttons |
| Approve-rent flow | - | - | - | double-tap idempotency |
| Pixel 7 chromium quick pass (key screens) | - | - | - | secondary |

## Stage riders (from UX_FOUNDATIONS A–E + PROMPT_REVIEW additions)
- Stage 1: Lens C13–20 + D21–27 on every form/flow; cognitive walkthrough (4 questions) on add-expense + onboarding; billing-day (payment_day) cross-screen consistency; sheet dismiss-confirm compliance sweep.
- Stage 2: Lens A1–6 per screen; B7–12 nav/consistency; contrast + targets (Ch. 4/7 numbers: 44pt floor, 4.5:1/3:1).
- Stage 5: Lens E28–33 copy sweep (one term per concept, plural imperative, verb-first CTAs); local-date-helpers grep law.

## Findings ledger
(appended per stage — AUD-### / OBS-### / KNOWN(id))
