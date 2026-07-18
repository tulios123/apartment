# RUN_STATE.md — audit continuation run 18.07.2026 (cloud session, owner in-flight)

**Branch:** staging (direct commits). **Environment:** Claude cloud container — Chromium via Playwright (WebKit unavailable here; all cells ran Chromium 393×852 + 320×852, DPR2, touch). Network to Supabase relayed through Node fetch (egress proxy blocks Chromium TLS; see MORNING_REPORT §0).
**Connected run:** YES — live login as dev@test.local, baseline verified (mortgage 5,019 · loan 2,320 · rent 4,300 · monthly 7,339 · equity 97,260 · debt 992,740 · forecast −3,113).
**Stress leftovers from 17.07 cleaned:** cleanup-stress.ts run with safety flag — 433 [STRESS] rows removed (392 tx, 25 tasks, 15 docs, 1 contract); baseline numbers re-verified live after cleanup. Stress-state matrix cells were captured BEFORE cleanup (home/finances/wealth ×2 themes).
**Counts this run:** live checks ~120 · found 2 new product bugs (AUD-010 double-tap double-insert · AUD-011 infinite splash on boot network failure) — both FIXED+verified · AUD-004 fixed (DevNotes) + Load-failed confirmed benign · 23 sub-44 touch targets fixed (invisible hit-floor) · SW-07/08/11/17/18/19/21 consolidated · 0 console errors across every surface/theme/width.

## Stages
| stage | title | status |
|---|---|---|
| 0 | Foundation & calibration | done (16-17.07) |
| 1 | Core functionality & financial correctness (live) | done (17.07) — money engine all-pass |
| 2 | Layout, UI & accessibility math | **DONE 18.07** — 51 cells × overflow/nav-overlap/44pt sweeps + visual review; 0 overflow, 0 real nav overlaps (year/range "overlaps" were clipped-accordion false positives), 23 sub-44 targets fixed to the AUD-003 floor, 2 accepted exceptions (bd-rows 37px gap-bounded · year-chart bars essential) |
| 3 | Smoothness & perceived performance | **DONE 18.07** — skeletons appear→clear on cold loads; step/sheet animations present; dirty-discard confirm verified on both sheet families (tx sheet + capture sheet): Esc/scrim → "לצאת בלי לשמור?", continue keeps data, discard closes, pristine closes silently; X = deliberate close (by design) |
| 4 | Resilience & stress | **DONE 18.07** — offline banner on/off ✔ · property-hub retryable error + recovery ✔ (route-abort) · empty-state: unreachable in month view with baseline data (virtual insurance rows back to 1.2024 — by design; EmptyState component verified in code + category-filter path) · approve-rent double-tap → **AUD-010 found+fixed** · boot-with-network-failure → **AUD-011 found+fixed** · seed-stress NOT run (owner cleanup was the outstanding item; done instead) |
| 5 | Code quality & static checks | **DONE 18.07** — SW-07/08/11/17/18/19/21 fixed (behavior-identical, details in AUDIT_FINDINGS); SW-12/06 prepare-only → docs/audit/PREPARED_SW12_SW06.md; date-helper law grep clean; eslint errors 15→15 (none added; HomeScreen −1) |
| 6 | Design golden list + approved product decisions | partial — no NEW owner approvals to execute; status pass done (see §Golden below) |
| 7 | Everything else until matrix closes | done to the extent reachable (see matrix U-cells) |
| 8 | Close-out | done — this file + AUDIT_FINDINGS + ROADMAP + MORNING_REPORT (he) |

## Coverage matrix (this run)
`V` visited w/ evidence (scratchpad screenshots + logged checks) · `U` unreachable(reason) · `C` code-level only.
Columns: light@393, dark@393, light@320.
| surface | L393 | D393 | L320 | notes |
|---|---|---|---|---|
| Splash (cold start) | V | V | V | initial-paint capture |
| Login (bypass-off :5174) | V | V | V | overflow ok, Google btn renders |
| Onboarding S1 ברוכים הבאים | V | V | V | |
| Onboarding S2 מסמכים | V | V | V | (step order: welcome→documents→purchase) |
| Onboarding S3 רכישה | V | V | V | + live soft-warnings (price/dates) |
| Onboarding S4 משכנתא | V | V | V | + full validation suite (task 1) |
| Onboarding S5 הלוואות | V | V | V | + validation suite |
| Onboarding S6 השקעה | V | V | V | |
| Onboarding S7 שכירות | V | V | V | + rent-0/inverted-dates/gaps live |
| Onboarding S8 ביטוח | V | V | V | + empty-save/premium-hint/date-block live |
| Onboarding S9 סיום + finish-early | V | V | V | dirty→dialog · untouched→clean skip, לא נשמר דבר |
| Home | V | V | V | + stress state (pre-cleanup) both themes |
| Finances month | V | V | V | + stress state |
| Finances year | V | V | V | breakdown-accordion false-positive investigated |
| Finances range | V | V | V | |
| Finances expense sheet | V | V | V | + dirty-discard flow |
| Finances tx drawer (edit) | U | U | U | row-click selector didn't open drawer in runner; edit path exercised via sheet (same BottomSheet) — revisit with better selector |
| Wealth main | V | V | V | + stress state |
| Wealth liabilities | V | V | V | |
| Scan review / doc list | C | C | C | needs a real scanned doc; code-level (ScanReview/ScanDocList in LiabilitiesV2) |
| Property: חוזה | V | V | V | |
| Property: ביטוח | V | V | V | |
| Property: משימות | V | V | V | |
| Property: מסמכים | V | V | V | |
| PropertyForm (binder edit) | V | V | V | modal-over-nav flags = overlay false positives |
| Settings | V | V | V | |
| FeedbackAdmin | V | V | V | as manager; non-admin gate C (isFeedbackAdmin) |
| Legal ×3 | V | V | V | in-app frame |
| Account menu popover | V | V | V | |
| Error screens | V | — | — | property-retry live (route-abort) + root boot-error live (AUD-011); root React boundary C |
| Offline banner | V | — | — | on/off live; Update banner C (needs version delta) |
| Quick-capture (Home) | V | V | V | typed state + numpad + discard |
| Approve-rent flow | V | — | — | incl. double-tap idempotency (AUD-010) |
| Pixel-class chromium pass | V | V | V | this entire run IS chromium (primary webkit N/A in cloud) |

## Golden-list status pass (stage 6 — no unapproved changes executed)
1 FAB dock — 🔴 open (product) · 2 voice pass — 🔴 open · 3 trash/X — partially standardized (ConfirmDialog everywhere verified in S3) · 4 keypad order — 🔴 open (bug-class but UX decision recorded) · 5 segmented unify — 🔴 open · 6 scan-entry merge — 🔴 open · 7 year-chart forecast hatch — 🔴 open · 8 duplicate all-clear — 🔴 open · 9 balloon-card dedup — 🔴 open · 10 bidi audit — month-pager verified live+code: CaretRight=back/CaretLeft=forward with shiftPeriod(∓1) — RTL-correct (FinancesV2 442-444).
Motion Qs answered from live runs: pager direction ✔ correct · sheet-vs-keyboard: visualViewport inset implemented (BottomSheet) · theme switch: token swap, no flash observed in dark boots · skeletons: no perpetual skeletons anywhere.

## Findings ledger (this run — details in AUDIT_FINDINGS.md)
- AUD-010 [FIXED] P2 · double-tap approve-rent inserted 2 rent transactions (sync reentry guard added; live-verified 1 tx; test rows cleaned).
- AUD-011 [FIXED] P2 · network failure at boot escaped the C3 retry ladder (supabase rejects vs {error}) → infinite splash; probeHasProperty wrapper; live-verified retry screen ~38s + recovery. NOTE: 38s = supabase-js internal retries ×4-attempt ladder; shortening = owner call.
- AUD-004 [FIXED] DevNotes deferred history-patch sync; Load-failed = WebKit nav-abort, benign (0 Chromium console errors all session).
- OBS-001: collapsed breakdown accordion keeps opacity-0 rows in the a11y tree (visibility not toggled) — cosmetic/a11y-tree only, no visual/hit impact (clipped).
- OBS-002: bsheet head has TWO .bsheet-close buttons (lightbulb+X share the class) — naming only, confusing for tooling/tests.
- OBS-003: baseline account has virtual insurance rows back to 1.1.2024 (policy start) — by design; makes the "empty month" state unreachable on this account.
