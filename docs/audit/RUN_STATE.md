# RUN_STATE.md — night run 16-17.07.2026 (machine clock unreliable; labels are machine time)

**Branch:** staging (commits go directly here; no checkout — shared working tree). **Run doc:** NIGHT_RUN.md (repo root).
**Counts:** found 0 · fixed 0 · improved 0 · parked 0 · KNOWN-deduped 0
**Last checkpoint commit:** (pending first commit)
**Next action:** Stage 0 item 5 — e2e infra files (playwright.config, e2e/lib), then pre-flight gate.

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
- [ ] playwright.config.ts + e2e/lib (login/archive/layout/console/network helpers)
- [ ] Pre-flight gate: dev server + Playwright reach authed Home (bypass=true confirmed in .env.local)
- [ ] Admin data-reset on test account → clean-account onboarding E2E → empty states → seed
- [ ] scripts/audit/seed-stress.ts + cleanup-stress.ts (anon key + dev sign-in; both safety flags; cleanup smoke-tested first)
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
