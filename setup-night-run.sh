#!/usr/bin/env bash
# ============================================================
#  setup-night-run.sh — one command, everything in place, launch
#  Run from the repository root:  bash setup-night-run.sh
# ============================================================
set -euo pipefail

if [ ! -d .git ]; then
  echo "❌  No .git folder here. Run this from the repository root."
  exit 1
fi

mkdir -p docs/audit

# ---------- 1/3 NIGHT_RUN.md (always refreshed to latest) ----------
cat > NIGHT_RUN.md <<'EMBED_NIGHT_RUN'
# NIGHT_RUN.md — Full-depth autonomous audit & fix run, "ניהול דירה"
**Single source of truth. Self-contained. No other prompt document applies.**

## Mission
Take the app as deep as it goes in one unattended run: find everything that stands between it and a top-of-the-line smooth experience — functionality, layout, smoothness, resilience, UX-principle compliance, code quality — and **fix it**, on staging, with evidence. The owner is asleep and will not answer questions. The run is judged on two things: real value shipped, and honest disclosure of every decision taken.

## Operating mode — bias to action
- **Default for every finding, P0 through P3: FIX IT.** Judgment calls included — pick the solution most consistent with the app's existing patterns and design tokens, implement it, and log the runner-up option with one line of reasoning. Parking is the exception, not the norm.
- **Never block on a question.** No answers are coming tonight. Decide, log, proceed.
- **No caps.** No maximum number of fixes, findings, or improvements. Depth and coverage win. Stop only when the coverage matrix (below) is complete or the session dies — and a dead session is fine, because the run is resumable.
- Mistakes are acceptable; **concealed** mistakes are not. Every fix carries evidence; every judgment call is disclosed; every revert is logged.

## The only two boundaries
1. **The database is shared between staging and production, with real family data.** Therefore: no schema changes, no migrations, no SQL, no Supabase config changes, no edge-function contract changes — not even additive ones, not tonight. Where a fix genuinely requires one, write the full proposal (migration draft included) into the report instead. Log in only with the designated test account (`TEST_USER_EMAIL` / `TEST_USER_PASSWORD` from `.env.local`). Every row created by tests is tagged: `[STRESS]` for seeded data, `[E2E]` for interaction-test rows. Deletion tests touch only rows this run created.
2. **Product-direction changes are the owner's.** Fixing that a flow is broken, janky, unclear, or inconsistent — yours, go. Redesigning what a flow *means* (e.g., onboarding step semantics, new screen concepts) — write the best proposal with options, don't implement.

Everything else — including wording, styling, structure-within-a-screen, error handling, timing, tests — is yours to fix.

## Resumability — the core mechanic
- **State file: `/docs/audit/RUN_STATE.md`.** Contains: the stage list with status (`done` / `in-progress` / `pending`), a per-stage checklist of remaining items, the coverage matrix (below), running counts (found / fixed / parked / improved), last checkpoint commit, and a one-line "next action". Update and commit it at every stage boundary and every ~5 fixes.
- **Launch = resume.** On start: if `RUN_STATE.md` exists, read it and continue from the first unfinished item; otherwise begin Stage 0. When the owner relaunches with "continue", do exactly that — no re-planning, no restarting, straight back to work — until every stage is `done`.
- **Never start a fix you cannot finish and commit in one go.** One finding = one commit (`fix(AUD-###): <title>`; improvements: `improve(OBS-###)`). Small diffs. All tests green before every commit.
- **Merge to `staging` at every green stage boundary** (direct merge or auto-merge; never leave work hanging on an open PR, never touch main/production).

## Coverage matrix — the depth contract
In Stage 0, enumerate from the code the complete surface inventory and write it into `RUN_STATE.md` as a matrix to be checked off:
- **Every route and screen:** Splash, Login, Onboarding (all 9 steps — forward AND back-chevron at each), HomeScreen, FinancesV2 (month / year / range views), WealthHub, PropertyAdminHub (all 4 tabs), Settings, error/load-failure screens.
- **Every overlay:** every modal, drawer, sheet, confirm dialog, popover (finance editor, transaction drawer, PropertyForm, expense keypad + details, task sheet, document sheet, account menu…).
- **Every state:** empty states (visited on the clean account, pre-seed), loaded states (post-seed, under stress data), expanded states (mortgage chevron, maintenance row, category accordion), loading, error, offline.
- **Both themes** (light + dark) for every visual check. Primary device: WebKit iPhone 16 Pro profile (402×874, DPR 3; define manually if the installed Playwright lacks it). Secondary quick pass: Chromium Pixel 7. Layout checks at widths 402 and 320.
- **Every interactive element:** every button tapped, every create/edit control double-tapped (idempotency), every form field typed into, browser-back tried inside every overlay and onboarding step.
The run is not complete until every cell is `visited` or marked `unreachable` with a one-line reason.

## Evidence rules (proportionate, not ceremonial)
- **Behavior / logic / money fixes:** reproducing test first (Vitest or Playwright) — fails before, passes after. Money math is non-negotiable: a test pins the correct number before the fix (this codebase already caught a rounding bug exactly this way).
- **Visual / CSS fixes:** before/after screenshots + re-run of the layout-integrity pass on affected screens.
- **Breakage protocol:** full Vitest + affected e2e specs after every fix. Red → one repair attempt → still red → revert that commit, park with a note. Never fix-forward on a broken suite.
- **No invented verification.** Three levels on every finding: `live-verified` (evidence attached) / `code-verified` (file:line) / `needs-manual` (physical device only). Never upgrade a claim.

---

# THE STAGES
Each stage = sweep → fix its findings → all green → commit → merge to staging → update state. Severity: **P0** wrong money math / data integrity / dead-end in a core flow; **P1** visible bug or jank a non-technical user notices; **P2** inconsistency or risky tech debt; **P3** polish. UX-instrument severities map **4→P0 · 3→P1 · 2→P2 · 1→P3 · 0→drop**.

## Stage 0 — Foundation & calibration
1. **Read:** `CLAUDE.md` (if present), `/docs/handoff/*`, `FAMILY_RELEASE_FIXES.md`, `_audit_reports/` + `_audit_fixes_log.md`, `QA_MASTER_CHECKLIST.md`, `UX_REVIEW.md`, `DESIGN_REVIEW.md`, `/docs/audit/DESIGN_UX_REVIEW.md` (screenshot design review), `/docs/audit/UX_FOUNDATIONS.md` (principle-traceable UX instrument). Treat `BUILD_PROMPT.md` as historical — it describes screens that no longer exist. Build `KNOWN_ISSUES_BASELINE` (id, source, status); findings are deduped against it — known issues get marked KNOWN with a reference, not re-reported.
2. **Calibrate:** this prompt was written from handoff documents; you have the repo. Write `/docs/audit/PROMPT_REVIEW.md` with factual corrections, missing checks, and wasteful steps — then apply your corrections yourself (fix facts, adjust execution, add checks). Untouchable: the two boundaries and the deliverables. Disagreements: log and proceed on best judgment.
3. **Environment:** `npm i -D @playwright/test`; `npx playwright install webkit chromium` (the single allowed package.json edit, plus `e2e` scripts). Build `/e2e/lib/`: login helper (test account only); screenshot archiver (every visited state, both themes → `/docs/audit/evidence/`); **layout-integrity pass** (runs on every visited state, both themes, at 402 and 320: overlapping interactive elements, viewport overflow, targets <44pt, clipped text without ellipsis) — every violation auto-files a finding with a screenshot; **console monitor** (any console.error/warn during any test = finding); **network logger** (duplicate fetches per navigation, never-resolving requests, post-unmount calls = findings).
4. **Pre-flight gate:** verify the test-account login actually succeeds in Playwright. If it fails, do not stall: reorder to run Stage 5 fully, fix everything code-verifiable, and state the blockage loudly in the state file and report.
5. **Sequencing:** if the protected admin data-reset works on the test account → reset, run the Onboarding E2E on the clean account, capture all empty states, **then** seed. Otherwise onboarding is code-analysis + report note.
6. **Seed scripts:** author `/scripts/audit/seed-stress.ts` + `cleanup-stress.ts`. Safety contract: refuses to run without `--owner-email` **and** the literal flag `--i-know-this-is-shared-supabase`; additive INSERTs only; every row tagged `[STRESS]`; cleanup deletes only tagged rows for that owner, including transactions generated from seeded recurring items; service-role key from local env only. Seed: ~400 transactions across 14 months (month boundaries, extremes 0.01–9,999,999, 200-char descriptions), 25 tasks (overdue/today/future/done), 15 documents, a contract ending in 10 days, recurring items incl. `day_of_month=31`, a second mortgage track with grace, a balloon loan. Run it.
7. Extract from UX_FOUNDATIONS Part 2 every item measurable live or in code and slot each into its stage checklist below (judgment-only taste items belong to the human reviews, not this run). If `/docs/audit/UX_LIVE_QUEUE.md` exists, absorb it as an additional checklist and mark its items answered as you go.

## Stage 1 — Core functionality & financial correctness (live flows)
Run every core flow end-to-end (all created rows tagged `[E2E]`): login; full onboarding on clean account (all 9 steps forward, back at each step, "סיים עכשיו" mid-way — then verify every hub renders sanely with partial data); add / edit / delete transaction; quick-capture from Home (free text + both buttons); **approve-rent double-tap** (count resulting rows); complete task → both paths of the suggested-transaction prompt; upload document → download → delete (own file only) → attach receipt to a transaction; edit contract; edit insurance; finance editor open → change value → close → Wealth updates; theme switch applies instantly everywhere.
**UX-instrument riders on every flow:** correct mobile keyboard per field (numeric for amounts); labels persist while typing (no placeholder-only fields); validation only after leaving a field, never per keystroke; entered values preserved on error; error messages specific and plain, not generic; destructive actions confirm or offer undo; visible response within ~400ms or a designed progress state; one clear success moment per flow. Run the **cognitive walkthrough live** on add-expense and onboarding (persona: non-technical family member, week one; four questions per step; every "No" is a finding).
**Data correctness, live + code:** cross-screen number consistency — the same rent / mortgage / forecast figures compared across Home, Finances, Wealth (any mismatch incl. rounding drift = P0/P1); seeded edges render right (month-boundary transactions bucket correctly — check Israel-midnight UTC off-by-one in storage/comparison/bucketing; `day_of_month=31` in short months; contract-ends-in-10-days badge; balloon treatment in Wealth; grace display; extremes; 200-char strings); forecast vs actual duplication near the forecast date; recurring item with past `end_date`; deletion integrity per relation (document↔transaction, contract↔utilities↔forecast rows, recurring↔generated transactions); ownership math at 0% / equity>value / missing value; **rounding law** — every rounding site found, one shared util, consistent direction; ad-hoc rounding is a finding. Where Vitest already covers a case, cite the test; where it doesn't, write the missing test as part of the fix.

## Stage 2 — Layout, UI & accessibility math
The layout-integrity pass across **every** matrix cell: every screen, tab, overlay, state — both themes, 402 and 320 — screenshots archived per screen × theme. Plus: **WCAG contrast computed from styles** (text 4.5:1 normal / 3:1 large; UI boundaries 3:1; both themes); visible keyboard-focus styles; number rendering (tabular-nums effective in aligned columns, ₪ position in RTL, thousands separators consistent, negative amounts); dark-mode sweep over the archive for un-themed surfaces (modals, charts, empty states, focus rings, Splash, error screens, native controls / `color-scheme`).
**Code side:** grep hex colors outside `src/index.css` (token violations — fix to tokens); physical vs logical CSS properties (RTL violations — fix); icons that must mirror in RTL vs must not; LTR islands (numbers, dates, emails) inside RTL text; spacing off the 8px rhythm, one-off radii/shadows/durations.

## Stage 3 — Smoothness & perceived performance
Cold-start trace with video — root-cause the known white flash (what paints before the theme applies: `index.html` background? late `data-theme`? splash timing? Heebo `font-display`?) and **fix it**. Tab-transition sweep with video (content jumps, spinner flicker under 150ms); modal/drawer stress — open/close each overlay 10× fast (stuck overlay, lost scroll-lock, state reset); each hub under slow-3G; a one-field edit closing a modal must not trigger a full-screen refetch — flag and fix heavy refetch patterns; list hygiene under 400+ rows (keys, memoization, state lifted too high, chart re-render on unrelated state). **Code:** service-worker update flow (stale bundle forever? user-facing refresh path?), code splitting (lazy Onboarding/Settings/heavy modals; record bundle composition), push registration not blocking first paint.

## Stage 4 — Resilience & stress
Offline mid-session (banner, clear error on mutation, no silent loss, draft survives); slow-3G on every flow (no infinite spinner without feedback); **double-submit sweep across every create/edit control in the app** (count rows; clean `[E2E]` noise after each assert); rapid tab-switching mid-fetch (stale content, console errors, unaborted requests); session expiry simulation mid-form (graceful re-login, no white screen); wrong file type + oversized upload (clear feedback); browser-back inside every overlay and onboarding step. **Code:** timeout/retry audit per fetch site; onboarding document-extraction edge function on slow network (can the user get stuck — fix the client side); push permission-denied and unsupported-browser paths; overscroll-bounce still disabled; two-device last-write-wins exposure (design note if unguarded).

## Stage 5 — Code quality & static checks
Run and fix fallout: `npx tsc --noEmit` · `npx vitest run` · `npm run build` (record chunk sizes) · `npx eslint .` if configured. Grep sweeps, fix the mechanical ones, file the rest: `console.log`/`debugger`; `: any` / `as any` / `@ts-ignore` / risky `!`; `TODO|FIXME|HACK`; `setTimeout` magic numbers (race band-aids — fix the race, not the number); hardcoded `dev@test.local` outside one config point; hardcoded URLs/keys. Dead code (pre-V2 remnants, unreachable routes, commented blocks — remove); duplicated currency/date formatting and fetch patterns (unify to one util); silent `catch {}` → the app's existing feedback pattern; error-boundary coverage per screen; setState-after-unmount / unaborted fetches; DB-schema vs `src/types/index.ts` drift (types side only). Close with an architecture-smells note (informational).

## Stage 6 — Design golden list + approved product decisions
Implement the design review's ten golden-list items, with two decisions already made by the owner's reviewer: (a) the lightbulb FAB is **docked into the header, never retired** — it is the feedback-pipeline entry; also hide "ניהול משוב" from non-admin users; (b) the expense keypad returns to the **standard 1-2-3-top LTR grid** — numeric keypads are not mirrored in RTL. Also implement the approved product items: **#3** remove the "ריבית" pill from quick-expense categories (manual interest double-counts the automatic forecast); **#4** rename the recovery card to **"כמה מההשקעה חזר"**; **#6** ownership percentage displays **floored to one decimal** (5.87% → 5.8%), consistent with the app-wide conservative-rounding law. The Hebrew **voice pass** ships as one dedicated commit (revertible as a unit), applying the instrument's content rules as the standard: CTAs start with a verb; one term per concept everywhere (one "all clear" phrase; one save grammar); plural imperative throughout; optional fields marked "(אופציונלי)" in the **label**, not the placeholder; no vague error copy. Dedupe against this run's own findings — where the audit and the design review name the same issue, fix once, cite both. Skip only what depends on the owner's still-open product questions (#1 nickname field, #2 insurance scan, #5 feedback entry duplication) — proposals welcome in the report.

## Stage 7 — Everything else, until the matrix closes
Remaining P2/P3 findings; improvements from your own observations (`improve(OBS-###)`, same evidence rules, each its own commit); and any coverage-matrix cell still unvisited — go visit it. This stage ends when the matrix is 100% visited-or-unreachable and the findings ledger has no unaddressed P0–P3 that is fixable within the boundaries.

## Stage 8 — Close-out
1. Delete all `[E2E]` rows. **Leave `[STRESS]` seed data in place** — the owner needs it for his hands-on pass; he runs `cleanup-stress` himself afterwards.
2. Update `AUDIT_FINDINGS.md` statuses: `FIXED (commit)` / `IMPROVED` / `PARKED` / `BLOCKED` — the file has been growing incrementally per stage (each stage appends findings deduped against baseline and prior stages).
3. Write **`/docs/audit/MORNING_REPORT.md` in Hebrew** — audience: the owner, with coffee, before any code:
   - **שורה תחתונה** — נמצאו / תוקנו / שופרו / הוחנו / נחסמו, אחוז כיסוי מהמטריצה, ומצב הסטייג'ינג עכשיו.
   - **מה תוקן** — לכל תיקון: מזהה, מה היה, מה שונה, איך הוכח (בדיקה או צילומי לפני/אחרי).
   - **החלטות שיקול-דעת שלקחתי** — מה נבחר, מה האלטרנטיבה, שורה למה. כל פריט = קומיט אחד, ביטול בלחיצה.
   - **מה הוחנה ולמה** — סכימה / כיוון-מוצר / דורש-טלפון בלבד, עם ההצעה המומלצת לכל פריט (כולל טיוטת מיגרציה איפה שרלוונטי).
   - **מה לבדוק ביד על הסטייג'ינג** — רשימת אימות התנהגות ממופה לתיקונים + מה שסומן `needs-manual` (התקנה למסך הבית, התראות אמיתיות, תחושת גלילה, ספארי רגיל מול מותקן).
   - **תקלות בריצה** — כל מה שנכשל, נחתך או רץ במצב מנוון, בכנות מלאה.
4. Final state update: all stages `done`, or the exact next action if the session is dying — so that "continue" lands on its feet.

## Quota economics
The five sweep-heavy stages may run their mechanical work through subagents pinned to `model: sonnet` (one subagent per stage, batched — every spawn pays a fixed warm-up); the lead handles calibration, triage, judgment fixes, and the report. Never view screenshots wholesale — the layout pass is programmatic; open an image only on a flagged violation plus one sampled dark-mode shot per screen. Quiet reporters, summarized grep output. If the window dies anyway: nothing is lost — checkpoints and the state file mean the next "continue" resumes mid-stride.

## Honesty under no supervision
No one is watching tonight, and the mode is maximal action — so the honesty bar is disclosure: every judgment call logged, every revert logged, nothing marked fixed without its evidence, no quiet crossing of the two boundaries. A wrong decision honestly reported is a good night's work; a right decision silently taken is still a process failure.
EMBED_NIGHT_RUN
echo "✓  NIGHT_RUN.md written (repo root)"

# ---------- 2/3 docs/audit/DESIGN_UX_REVIEW.md (kept if already present) ----------
if [ -f docs/audit/DESIGN_UX_REVIEW.md ]; then
  echo "✓  docs/audit/DESIGN_UX_REVIEW.md already exists — keeping yours"
else
cat > docs/audit/DESIGN_UX_REVIEW.md <<'EMBED_DESIGN_REVIEW'
# DESIGN & UX REVIEW — "ניהול דירה" (Mobile · Light Theme)

Screenshot review · 16.7.2026 · 24 screenshots (iPhone, PWA) · Yardstick: `/docs/handoff/design-language.md` + `screens.md`; comparison standard: first-tier banking apps (ANZ Plus).
Findings are tagged inline: **[bug]** / **[design]** (opinion within the existing language) / **[product question]** (needs a discussion, not a task). Items marked *(verify live)* cannot be confirmed from a static shot.

---

## 0. Coverage inventory

| Screen-map area | Covered | Notes |
|---|---|---|
| Home — ראשי | ✔ | "All clear" state only; no pending-approval state |
| Finances — תזרים | ✔ | Month, Year, Range + new-expense flow (2 steps) |
| Wealth — הון | ✔ | Full scroll: hero, accelerator, financing structure, recovery card, stats |
| Financing & costs editor | ✔ | Full scroll (5 shots): summary, 6 tracks, docs, loans, equity & costs |
| Property hub | ✔ | Cover + all 4 tabs (חוזה / ביטוח / משימות / מסמכים) |
| Forms | ✔ | Contract edit, Policy edit, Property edit (top), New document |
| Sheets | ✔ | New expense (keypad + details), New task |
| Account menu | ✔ | Popover only — Settings screen itself not captured |
| Login / Onboarding | ✖ | Deferred by owner — in gaps list |
| Dark theme / Splash / states | ✖ | See gaps list (§6) |

---

## 1. Overall verdict

The bones are genuinely banking-grade: one-number heroes, tabular numerals that actually align money columns, a coherent card system, and RTL that is clearly deliberate rather than translated. Financial integrity across screens is flawless — 4,300−3,838=+462 agrees between Home and Finances; 3,113+651+74=3,838; 64,025 = 1,090,000−875,975−150,000; the six editor tracks sum exactly to the 4,317 ₪ grace warning — every screen agrees with every other, which is the hardest thing to get right and it is right. On the works→top-of-the-line scale the app sits in the upper third. The single thing that most cheapens it right now: **the control vocabulary is not unified** — dashed borders carry four meanings, green tags five, three single-select styles, two delete icons, and CTA grammar wanders (שמור / שמירה / שמירת הוצאה / המשך). Each screen is polished in isolation; the system's voice wavers between screens, and that wavering is precisely what a user feels as "almost, but not a bank."

---

## 2. Per-screen review

### 2.1 Home — ראשי
**Verdict:** right idea (calm command center), wrong vertical budget — the money is below the fold.

1. **[design]** Duplicate "all clear": the subtitle "הכול רגוע היום — אין מה לעשות עכשיו." and the card "הכול מטופל…" say the same thing in adjacent components. Keep the card, cut the subtitle — reclaim ~90px and lift "תזרים החודש" toward the fold.
2. **[design]** Semantic color splits inside one card: received rent "4,300 ₪" is green, but "‎-3,838 ₪" and "+462 ₪" are navy — and Finances paints the very same +462 green. Pick one law — color-by-sign (the Finances convention) — and apply it here too.
3. **[design]** The lightbulb FAB overlaps the green progress bar and the coins icon. A floating control must never sit on financial content. (Cross-cutting §3.1 — this pattern repeats on nearly every screen.)
4. **[design]** "הוצאה" / "משימה" buttons use dashed borders — but dashed is already the app's language for forecast rows and missing documents. Secondary actions should be solid-outline. (Cross-cutting §3.2.)
5. **[microcopy]** The tag "אוטומטי · הוצאה" mixes execution mode with direction; the minus sign already carries direction. "אוטומטי" alone.

**Keep:** the quick-capture placeholder "למשל: שילמתי 350 ₪ על תיקון ברז…" — the best onboarding-free teaching in the app.

### 2.2 Finances — Month
**Verdict:** clear ledger with the right number on top; the add-button and the legend both shout louder than they should.

1. **[design]** "הוספת תנועה" is the largest element on the screen — physically bigger than the balance number. On a reading screen that inverts hierarchy. Standard button height, or anchor it next to the section title like "+ חוזה חדש".
2. **[microcopy]** The legend "מקווקו = תחזית מהחוזה/משכנתא" explains a visual code in words while every forecast row already carries a "תחזית" tag — double encoding plus a legend that admits the encoding isn't self-evident. Cut the legend, keep the tag.
3. **[bug]** *(verify live)* The month pager places ‹ left and › right of "יולי 2026" — the LTR convention. In RTL, forward-in-time should be the **left** chevron. Verify tap mapping and that the slide animation direction matches.
4. **[design]** The forecast row wears three markers at once — dashed frame, "תחזית" tag, and a distinct orange icon. Two suffice (dashed + tag).

**Keep:** "קרן 0 ₪ · ריבית 3,113 ₪" on the mortgage forecast row — surfacing the grace-period truth inside the ledger is exactly the transparency this product promises.

### 2.3 Finances — Year
**Verdict:** correct RTL chart — but the future is painted as confidently as the past.

1. **[design]** Aug–Dec 2026 forecast bars render in the same solid red/green as actuals, while the list below distinguishes forecasts with dashed borders and tags. Encode forecasts in the chart too (reduced opacity or hatching) — one concept, one look.
2. **[design]** The current-month highlight (יול) is a tint so light it barely registers at arm's length. Strengthen it.

**Keep:** the month axis runs right-to-left (ינו rightmost) — correct RTL charting, rarer than it should be.

### 2.4 Finances — Range
**Verdict:** does its job; the footer tries to be both a summary and a tutorial.

1. **[microcopy]** "סך התקופה: ‎+1,013 ₪ על פני 5 חודשים לחצו על עמודה לפירוט" — two sentences fused, and the blue "לחצו על עמודה לפירוט" looks like a link but is an instruction. Split them, or drop the hint and let the chart's tap affordance do the work.
2. **[bug]** *(verify live)* Bidi date-range ordering is inconsistent: the range header here reads start-first in reading order (10.3 → 16.7 from the right), while the contract card's "תקופה" appears to read end-first. One of the two is bidi-swapped. Enforce with LRM/RLM marks; house law: **start date first in reading order (right)**.

**Keep:** "מאזן התקופה" stays inside the מאזן החודש / מאזן השנה term family — one concept, one word.

### 2.5 Wealth — הון (hero + accelerator)
**Verdict:** the strongest screen in the app — one navy hero, one number, a story that reads top-down. The accelerator card needs labeling discipline.

1. **[design]** "ערוך מימון ועלויות" floats as a lone outline pill above the page, detached from everything. Every other page anchors its action to a section ("+ חוזה חדש", "+ פוליסה חדשה"). Anchor it to the "מבנה המימון" section header.
2. **[design]** The "+381 ₪ לבעלות החודש" pill on the hero has full button anatomy (border, pill, arrow icon) but is static — false affordance. Either make it scroll to מאיץ ההון or restyle as a plain badge.
3. **[design]** מאיץ ההון: the thin progress bar under "מכל תשלום חודשי של 3,764 ₪" is unlabeled — nobody can say what it measures. Label it ("חלק הקרן מהתשלום") or delete it.
4. **[microcopy]** "עמלה לבנק" as the caption for interest (3,383 ₪, 90%) — interest is not a fee, and this app's brand is precision. "ריבית לבנק".
5. **[design]** "בבעלותך 6% מהנכס" — the actual value is 5.87%; standard rounding flatters. Per the house rule of conservative presentation, show one decimal (5.9%) or floor.

**Keep:** the ownership bar reads right-to-left as *yours → family → bank* — the RTL order itself tells the story correctly.

### 2.6 Wealth — financing structure section
**Verdict:** the grace warning is the best single line in the app; the balloon cards say everything twice, three times.

1. **[design]** Each balloon card states the balloon fact twice ("נפרעת במכירה" in the meta line **and** under the amount) × 3 near-identical cards = six repetitions on one screen. One line per card — or better, one "מימון משפחה · 150,000 ₪" group card with three rows (אמא / אבא / סבתא).
2. **[design]** "נפרעו 0%" appears twice on the mortgage card (meta line + progress caption). Once.
3. **[design]** The same balloon loans render as grey dashed cards here and as white orange-edged cards inside the editor — same entity, two costumes, ten seconds apart. Pick one card treatment.

**Keep:** "גרייס עד 3.2028 · תשלום מלא 4,317 ₪" in warning orange — the single most important risk in this portfolio, correctly colored, correctly placed.

### 2.7 Wealth — "הכנסות מול הוצאות" card + stats strip
**Verdict:** the most honest card in the app, wearing the wrong title.

1. **[product question]** The card actually shows **capital recovery** — rent received vs. capital invested vs. interest and maintenance paid, resolving to "הושקע נטו (טרם הוחזר)". "הכנסות מול הוצאות" undersells it and collides with the ledger's mental model. Candidate: "כמה מההשקעה חזר".
2. **[design]** The lightbulb FAB overlaps the "4.7%" gross-yield stat — the worst instance of the FAB-over-numbers pattern (§3.1).

**Keep:** tabular-nums earning its keep — the four amounts align to the digit. This is what banking apps get wrong and you got right.

### 2.8 Financing & costs editor (modal)
**Verdict:** complete and honest, but it's a five-screen scroll wearing a modal's clothes — and it hosts most of the app's inconsistencies.

1. **[design]** *(verify live)* The six track cards show **post-grace** payments (53+885+559+1,102+750+968 = 4,317 ₪) while the navy summary above says "תשלום חודשי 3,764 ₪" (today's grace payment + loan). Nothing on screen reconciles the two — a family member who adds the cards will hit a contradiction. Add a grace note per affected track (e.g., "בגרייס · תשלום מלא מ-3.2028") or show current-vs-full on each card.
2. **[design]** Track-type tags borrow status colors: success-green for "קבועה לא צמודה", warning-tan for "משתנה", blue for "פריים". Green/orange are the app's state semantics — using them for categories injects judgment (fixed=good, variable=caution) and dilutes real warnings like the grace banner. Use the decorative palette (purple/teal/coral) for types.
3. **[design]** Four AI-scan entry points, three styles: solid light-blue "סריקת מסמך משכנתא (AI)" / "סריקת מסמך הלוואה (AI)" / "סריקת חוזה שכירות (AI)", and the property form's dashed "📄 העלו חוזה רכישה — שמירה + מילוי אוטומטי". One component, one wording — and the emoji goes (the icon system is Phosphor).
4. **[design]** Mortgage document rows show raw filenames ("IMG_9999.png") as titles. These are typed documents — title by type + date, filename as caption.
5. **[design]** "שמור" as a lone bottom-left pill here, a שמור+ביטול pair in the policy form, full-width "שמירה" in sheets — three form-footer patterns. Pick one per container: full-width primary on sheets, sticky footer pair on full-screen forms.

**Keep:** live totals at the bottom ("סה"כ הושקע 334,735 ₪", "הון עצמי נטו… 184,735 ₪") update the story as you type — the right feedback loop for a financial editor.

### 2.9 Property hub — cover + Contract tab
**Verdict:** the cover card is a good "property passport"; delete affordances are the tab's weak point.

1. **[design]** The X icon deletes contracts and policies, while the editor uses a trash icon for loans. X means "close" everywhere else in the OS — X-as-delete is a data-loss trap for family users. Trash everywhere; X only dismisses. *(Confirm a delete-confirmation dialog exists — not visible in shots.)*
2. **[microcopy]** Tag "236 ימים" — days of what? "נותרו 236 ימים".
3. **[product question]** The cover headline is "הנכס שלי, אשקלון" because the street field literally contains "הנכס שלי" (see 2.19). The model conflates nickname and address — before family rollout, every property will be called "הנכס שלי".
4. **[design]** The green cover tag fuses tenant + status ("חומי–ניהול נכסים ויזמות בע"מ · חוזה פעיל") into one long pill that will wrap with a longer tenant name. Split: tenant as text, status as tag.

**Keep:** signature/delivery dates as quiet metadata at the card's foot — present, not shouting.

### 2.10 Property hub — Insurance tab
**Verdict:** clean and rhythmical; the tab's one number whispers.

1. **[design]** "סה"כ: 74 ₪ / חודש" is the tab's headline stat rendered as small grey text opposite the add-button. Promote it — same treatment as the documents tab's "3/6" counter.
2. **[design]** X-as-delete again (see 2.9-1).

**Keep:** the policy card format — "ביטוח משכנתא · ישיר", monthly premium, period — three facts, no fat.

### 2.11 Property hub — Tasks tab
**Verdict:** calm empty state — but it's the third different phrase for "all clear", and done-tasks are struck through into illegibility.

1. **[microcopy]** "הכול תחת שליטה" here, "הכול מטופל" on Home, "הכול רגוע היום" in the greeting. One house phrase for "all clear", reused.
2. **[design]** Maintenance-log entries get strikethrough + green check + "נסגר [date]" — triple done-encoding, and strikethrough makes history harder to scan ("when did I last check the boiler?"). Drop the strikethrough.
3. **[design]** Inline-add uses a **+** circle; Home's quick capture uses an **arrow** circle for the same submit-inline-text gesture. One icon.
4. **[design]** The empty-state card spends ~40% of the viewport on one sentence; half the padding buys the maintenance log a place above the fold.

**Keep:** יומן תחזוקה as a separate, quieter section below open tasks — correct hierarchy.

### 2.12 Property hub — Documents tab
**Verdict:** the "3/6" checklist metaphor is the best family-facing idea in the app; the card states need one law.

1. **[design]** Three card states with unclear grammar: dashed = missing, white+check = exists, blue-border+check = exists-with-count ("משכנתא · 4 מסמכים"). The blue border reads "selected", not "multiple". Law: dashed=missing, white+check=exists, count as a plain badge.
2. **[microcopy]** "חסר — העלה" is singular imperative in an app that speaks plural ("בחרו קובץ", "לחצו על עמודה", "הקלידו משימה"). "העלו". (Part of the voice pass, §3.4.)
3. **[design]** אוספים pills mix affordances: "קבלה 5" opens a list, "חשבונית +" adds. Same pill, two verbs — differentiate count-chip from add-chip.

**Keep:** "מסמכי הנכס 3/6" — progress framing turns paperwork into a completable game.

### 2.13 Contract edit form
**Verdict:** scan-first layout is right; this form hosts single-select style #2.

1. **[design]** "צ'ק / העברה בנקאית" uses a white-thumb-on-grey segmented; Finances uses a blue-fill segmented; the expense sheet uses outline pills for the same single-choice job. Three styles — one component app-wide (recommend the blue-fill; it is the most legible).
2. **[design]** *(verify live)* The empty phone field appears with different corner geometry/height than its sibling inputs — confirm it shares the input component.

**Keep:** "סריקת חוזה שכירות (AI)" at the very top — scan-then-correct is the right order of operations.

### 2.14 Policy edit form
**Verdict:** fine bones; the only entity form without an AI entry, and the optional-marking convention breaks here.

1. **[product question]** Contract, mortgage, loan, and property all offer AI scan; insurance doesn't. If the extractor supports policies — add the button; if not, this is a roadmap asymmetry worth noting, not a styling one.
2. **[microcopy]** Optional is marked via placeholder "אופציונלי" here, via label suffix "(אופציונלי)" in the document sheet. Label suffix everywhere — placeholders die on focus.
3. **[design]** Footer שמור+ביטול pill pair — the third footer pattern (see 2.8-5).

**Keep:** פרמיה with a חודשי/שנתי toggle, stored normalized (the card shows monthly) — good data hygiene.

### 2.15 New expense — step 1 (keypad)
**Verdict:** the two-step flow (amount → details) is the calmest capture pattern there is; the keypad itself is mirrored — and only two-thirds mirrored.

1. **[bug]** The digit rows are RTL-mirrored (top row reads 3-2-1, so **1 sits top-right**) while the bottom row keeps LTR positions (⌫ bottom-right). Numeric keypads are universal artifacts — Hebrew iOS keeps 1 top-left — and the half-mirroring makes it internally inconsistent too. Restore the standard grid; muscle memory beats mirroring.

**Keep:** one decision per screen — amount first, everything else later.

### 2.16 New expense — step 2 (details)
**Verdict:** the pill taxonomy works; the date is asked twice and the back arrow points the wrong way.

1. **[bug]** *(verify live)* The amount chip's arrow ("‏← 250₪") points left; the house RTL rule (the onboarding chevron) is back = **right**. If tapping it returns to the keypad, flip the arrow.
2. **[design]** The date is asked twice: quick pills ("אתמול / היום") **and** a calendar button also labeled "היום". Merge into one row: [אתמול | היום | תאריך אחר…].
3. **[product question]** Only three category pills are visible (תיקונים / ריבית / אחר) with no overflow affordance — is the taxonomy complete? And manual "ריבית" invites double-counting against the automatic interest forecast; consider a guard or removal.
4. **[microcopy]** CTA "שמירת הוצאה" vs. "הוספת תנועה" vs. "שמור" vs. "המשך" — the CTA grammar zoo (§3.5).

**Keep:** אופן תשלום pills mirror how Israelis actually pay, ביט first — localized, not translated.

### 2.17 New task sheet
**Verdict:** minimal and correct.

1. **[microcopy]** "הוסף תאריך ושעה" — singular imperative again (voice pass, §3.4).

**Keep:** the source button ("משימה") highlights behind the opened sheet — visible cause-and-effect.

### 2.18 New document sheet
**Verdict:** this sheet is the convention-setter — copy it everywhere.

1. **[design]** Default סוג = "אחר" buries the taxonomy. When opened from a typed context, prefill from context; otherwise leave unselected.

**Keep:** "שם (אופציונלי)" + placeholder "ברירת מחדל: שם הקובץ" — the correct optional pattern, and honest about defaults.

### 2.19 Property edit form
**Verdict:** the auto-fill promise is the trust move; placeholders need discipline.

1. **[design]** מ"ר placeholder is a grey "0" — zero as placeholder reads as a value. Empty field, or an example ("למשל: 85").
2. **[design]** The scan CTA carries an emoji (📄) — the only emoji in a Phosphor-icon app. Replace with the system icon (folds into the AI-button unification, 2.8-3).
3. **[product question]** רחוב holds "הנכס שלי" — the nickname lives in the address field (see 2.9-3).

**Keep:** the explainer under the scan button says exactly what will be extracted and that "אפשר לתקן לפני השמירה" — transparency as microcopy.

### 2.20 Account menu
**Verdict:** clean, correctly RTL-aligned popover.

1. **[product question]** "ניהול משוב" in the menu and the lightbulb FAB both point at feedback. For family users: is the menu item admin-only? If yes, hide by role; if both ship, they compete.

**Keep:** destructive "יציאה" isolated below a divider, in danger red — textbook.

---

## 3. Cross-cutting patterns (fix once, win everywhere)

1. **The lightbulb FAB occludes content on nearly every scrolling screen** — including the gross-yield stat (2.7) and editor footnotes. Dock it into the header (as modals already do) or retire it in favor of the menu's feedback entry.
2. **Dashed border means four things**: forecast rows, missing documents, add-buttons, and secondary actions — plus the balloon "passive" cards. Reserve dashed for exactly two: forecast (with tag) and empty-slot/add. Secondary actions become solid-outline.
3. **The green tag carries five meanings**: "התקבל", "חוזה פעיל", "236 ימים", "קיים", "קבועה לא צמודה". Keep green tags for state; move category tags (mortgage track types) to the decorative palette.
4. **Hebrew voice**: plural imperative dominates (בחרו / לחצו / הקלידו / העלו) but "העלה" and "הוסף" slip through; "all clear" has three phrasings; and the app bar says "ניהול דירה" while everything inside says "נכס". One voice pass over every string — one term per concept, plural imperative throughout.
5. **CTA grammar**: שמור / שמירה / שמירת הוצאה / הוספת תנועה / המשך coexist. One grammar (verbal noun) + container-consistent footers: full-width on sheets, sticky pair on full-screen forms.
6. **Single-select controls come in three skins**: blue-fill segmented, white-thumb segmented, outline pills. One component.
7. **Delete iconography**: X vs. trash (2.9-1). Trash deletes; X closes.
8. **Header budget**: navy status strip + app-name bar ("ניהול דירה" + avatar) + page title = three stacked headers before content, on every screen. Merge the page title into the top bar — the app doesn't need to introduce itself on every screen. The biggest single vertical-space win available.
9. **Forecast encoding diverges** between list (dashed + tag) and charts (solid bars). One encoding.
10. **Bidi discipline for LTR islands**: date ranges order inconsistently across screens (2.4-2). Directional marks + a written law: start date first in reading order.

---

## 4. The golden list (polish-per-effort, ranked)

1. Dock or retire the lightbulb FAB — every screen stops occluding numbers. **[design]**
2. One-hour Hebrew voice pass: plural imperatives, one "all clear" phrase, one CTA grammar. **[microcopy]**
3. Trash = delete everywhere; X = close only (+ confirm dialog verified). **[design]**
4. Restore standard keypad digit order (1-2-3, LTR grid). **[bug]**
5. Unify single-select to one segmented component (blue-fill). **[design]**
6. Merge the four AI-scan entries into one component; drop the emoji. **[design]**
7. Dim/hatch forecast bars in the year chart to match the list's forecast language. **[design]**
8. Home: delete the duplicate "all clear" subtitle; the cashflow card rises toward the fold. **[design]**
9. De-duplicate the balloon-loan cards (one line each, or one family-financing group card). **[design]**
10. Bidi audit: date-range ordering + month-pager chevron direction. **[bug]**

---

## 5. Product questions (collected — discussion before execution)

1. **Nickname vs. address**: add a כינוי נכס field before family rollout? The cover currently reads "הנכס שלי, אשקלון" because the nickname lives in רחוב.
2. **Insurance AI scan** — in or out of the extractor's scope?
3. **Expense category taxonomy**: is the 3-pill set (תיקונים / ריבית / אחר) complete? Should manual "ריבית" be guarded against double-counting with the automatic forecast?
4. **Rename "הכנסות מול הוצאות"** to reflect capital recovery ("כמה מההשקעה חזר")?
5. **"ניהול משוב" vs. the lightbulb** — which one do family users see, and what does each do?
6. **Ownership % rounding**: 5.87% displays as 6% — adopt one-decimal/floor per the conservative-presentation principle?

---

## 6. Gaps — to complete coverage

- Login, Onboarding (deferred by owner), Settings screen, Splash.
- **Dark theme — zero coverage**; the token swap warrants its own pass.
- States: action center with a pending rent approval; transaction edit drawer; category breakdown expanded; loading/skeletons; error banner; offline banner; an empty Finances month.
- Home on a busy morning (open tasks + renewal alert) — only the calm state was captured.
- The year-view screenshot is partially covered by a WhatsApp notification — reshoot the period-switcher area.
- Screen recordings for the motion questions below.

---

## 7. Motion questions for a live pass (static shots cannot judge)

1. Month pager: does the **left** chevron advance time (RTL-forward), and does the slide animation direction match?
2. Property tabs: transition type, and does the cover's scroll position persist across tabs?
3. Financing editor: open/close animation; save feedback (progress → success); scroll performance across its full length.
4. Expense flow: keypad→details transition continuity; does tapping the amount chip return to the keypad?
5. Bottom sheets vs. the iOS keyboard: does the sheet resize smoothly or jump when the task input focuses?
6. Quick capture: what does the send arrow show while the AI parse runs?
7. Category accordion: expand animation and chart draw-in.
8. Wealth scroll (nested cards + bars): smooth or jank?
9. Theme switch: instant token swap or flash? (The white flash on load is already a known family-test issue.)
10. Push-permission flow from Settings: what does the in-app state show while iOS asks?
EMBED_DESIGN_REVIEW
echo "✓  docs/audit/DESIGN_UX_REVIEW.md written"
fi

# ---------- 3/3 docs/audit/UX_FOUNDATIONS.md (kept if already present) ----------
if [ -f docs/audit/UX_FOUNDATIONS.md ]; then
  echo "✓  docs/audit/UX_FOUNDATIONS.md already exists — keeping yours"
else
cat > docs/audit/UX_FOUNDATIONS.md <<'EMBED_UX_FOUNDATIONS'
# UX_FOUNDATIONS.md

*A UX primer and reusable evaluation instrument for the team behind ניהול דירה. Study material first; yardstick second. The instrument is deliberately app-agnostic so its findings carry independent authority when run against the app.*

Compiled from primary sources (Nielsen Norman Group, Laws of UX, Apple Human Interface Guidelines, Material Design, GOV.UK Design System, Shopify Polaris, WebAIM/W3C, rtlstyling.com). Retrieval date: 16 July 2026.

---

## PART 1 — THE PRIMER

### Chapter 1 — The Usability Canon

#### 1a. Nielsen's 10 Usability Heuristics
Source (all ten): https://www.nngroup.com/articles/ten-usability-heuristics/

**1. Visibility of System Status**
Essence: The interface should always tell the user what is happening, through feedback delivered quickly. When people can see the current state, they learn the result of what they just did and can decide what to do next. Predictable feedback builds trust.
Example: A "You Are Here" marker on a mall map tells you where you stand before you decide where to go.

**2. Match Between the System and the Real World**
Essence: Speak the user's language — familiar words, phrases and concepts, not internal jargon. Follow real-world conventions and present things in a natural order. Controls that map to outcomes the way the real world does ("natural mapping") are easier to learn and remember.
Example: Stovetop knobs laid out in the same arrangement as the burners, so you know which knob controls which element.

**3. User Control and Freedom**
Essence: People act by mistake. They need a clearly marked "emergency exit" — undo, cancel, a way out — so they never feel trapped. Easy reversal creates confidence.
Example: Just as physical buildings need clearly marked exits, digital flows need obvious cancel/undo.

**4. Consistency and Standards**
Essence: The same word or action should always mean the same thing. Follow platform and industry conventions (external consistency) and stay consistent within your own product (internal consistency). Breaking convention forces people to relearn.
Example: Hotel check-in counters are near the entrance; consistency across hotels meets the expectation.

**5. Error Prevention**
Essence: Good error messages matter, but preventing the error is better. Remove error-prone conditions, or ask for confirmation before a risky, committing action. Two error types: slips (inattention) and mistakes (wrong mental model).
Example: Guard rails on a mountain road stop the error before it happens.

**6. Recognition Rather Than Recall**
Essence: Minimise memory load. Keep options, actions and needed information visible or easy to retrieve, so people recognise rather than remember. Human short-term memory is limited.
Example: It is easier to confirm "Is Lisbon the capital of Portugal?" than to recall the capital unaided.

**7. Flexibility and Efficiency of Use**
Essence: Let novices succeed the simple way while giving experts accelerators (shortcuts, gestures, personalisation). One flow can serve both if the fast path stays out of the beginner's way.
Example: A map shows standard routes, but a local can take a known shortcut.

**8. Aesthetic and Minimalist Design**
Essence: Every extra unit of information competes with the essential ones and dilutes them. Keep content and visuals focused on the user's primary goal. This is about focus, not flat visuals.
Example: An ornate teapot with a beautiful but unusable handle sacrifices function for decoration.

**9. Help Users Recognise, Diagnose, and Recover from Errors**
Essence: Error messages should be in plain language (no codes), state the problem precisely, and offer a constructive way out. Use visual treatment (e.g. bold red) so people notice them.
Example: A "Wrong Way" road sign names the problem and tells the driver to stop.

**10. Help and Documentation**
Essence: Ideally the product needs no explanation, but when help is needed it should be searchable, task-focused, concise, and delivered in context with concrete steps.
Example: Airport information kiosks solve problems in context, right where they arise.

#### 1b. Norman's Core Concepts
Sources: https://www.nngroup.com/articles/ten-usability-heuristics/ (mapping, constraints, feedback referenced there); https://www.interaction-design.org/literature/topics/affordances (affordance/perceived affordance, per Don Norman, *The Design of Everyday Things*)

**Affordance** — Essence: The relationship between an object and a user that makes an action possible. A glass affords holding liquid. In screen interfaces the raw affordances are limited (click, tap, drag, type), so the design must make the *right* ones obvious.

**Perceived affordance / Signifier** — Essence: On screen, what matters is what the user *perceives* they can do, based on learned conventions and visual cues. A signifier is the perceptible cue (a button that looks pressable, an underline that says "link") that advertises the affordance. Consistency across products is what makes perceived affordances legible. Source: IxDF page above.

**Feedback** — Essence: Show the result of an action immediately, so users know it registered and worked. Without feedback people repeat actions or assume failure. (Same idea as Heuristic 1.)

**Mapping** — Essence: The correspondence between a control and its effect. Natural mapping (control layout mirrors the thing it controls, e.g. stovetop knobs) makes an interface feel intuitive. Source: Heuristic 2 page.

**Constraints** — Essence: Deliberately limiting possible actions prevents errors. Good defaults and disabling invalid options guide people onto the correct path. Source: Heuristic 5 page (slips avoided "by providing helpful constraints and good defaults").

**Conceptual model** — Essence: The user's internal understanding of how the system works. Mistakes happen when the design's model and the user's model diverge (Heuristic 5). Matching the real world (Heuristic 2) keeps the two models aligned.

---

### Chapter 2 — Psychology Laws with Product Consequences
Source hub: https://lawsofux.com/ (individual URLs below)

**Fitts's Law** — https://lawsofux.com/fittss-law/
Essence: The time to hit a target depends on its size and its distance. Bigger, closer targets are faster and more reliable to acquire; small or far ones cause misses.
Consequence: Make touch targets large, space them apart, and place frequent actions where the thumb already is.

**Hick's Law** — https://lawsofux.com/hicks-law/
Essence: Decision time grows with the number and complexity of choices.
Consequence: Minimise options when speed matters, break complex tasks into steps, highlight a recommended default. (Site examples: Google homepage, Apple TV remote, Slack's progressive onboarding.)

**Jakob's Law** — https://lawsofux.com/jakobs-law/
Essence: "Users spend most of their time on other sites. This means that users prefer your site to work the same way as all the other sites they already know."
Consequence: Lean on established patterns; leverage existing mental models rather than inventing new interactions.

**Miller's Law** — https://lawsofux.com/millers-law/
Essence: The average person holds about 7 (±2) items in working memory — but do not misuse "seven" as a design limit. The real lesson is chunking.
Consequence: Group content into meaningful chunks so it is easier to process and remember.

**Doherty Threshold** — https://lawsofux.com/doherty-threshold/
Essence: Productivity soars when the system responds in under 400ms, keeping neither person nor computer waiting.
Consequence: Keep interactions fast; use immediate visual feedback (skeletons, optimistic UI) when real work takes longer.

**Law of Proximity** — https://lawsofux.com/law-of-proximity/
Essence: Objects placed near each other are perceived as a group.
Consequence: Use spacing, not just lines, to signal which labels, numbers and controls belong together.

**Law of Common Region** — https://lawsofux.com/law-of-common-region/
Essence: Elements inside a shared, clearly bounded area are perceived as one group. A border or a background colour creates that region.
Consequence: Cards (white on grey) are a legitimate grouping device; the container itself communicates relationship.

**Serial Position Effect** — https://lawsofux.com/serial-position-effect/
Essence: People best remember the first and last items in a series; the middle fades.
Consequence: Put key actions/navigation at the start and end (edges); place least-important items in the middle.

**Peak-End Rule** — https://lawsofux.com/peak-end-rule/
Essence: People judge an experience by its most intense moment (the peak) and its ending, not the average. Negative moments are recalled more vividly than positive ones.
Consequence: Invest design effort in the emotional high points and the final moment of a flow. (Site examples: Mailchimp's send-success moment, Uber.)

**Aesthetic-Usability Effect** — https://lawsofux.com/aesthetic-usability-effect/
Essence: People perceive attractive design as more usable, and are more tolerant of minor problems in it.
Consequence: A calm, polished visual system (the "ANZ Plus" ambition) genuinely raises perceived quality — but it can also mask real usability issues, so still test.

---

### Chapter 3 — The Evaluation Method Itself

**How a heuristic evaluation is run** — https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/
Essence: Evaluators judge an interface against a set of heuristics to surface likely problems without recruiting users. Best practice:
- Use 3–5 evaluators; each reviews **independently** first (no one sees others' notes until done), because a single evaluator misses most issues.
- **Narrow the scope**: one task, one section, one user group, one device at a time.
- Two passes: first move through the task just to learn it; second pass, note each element that violates a heuristic, with a recommendation.
- Then **consolidate**: cluster issues (affinity diagram), discuss agreement/disagreement, and prioritise.
- A heuristic violation is not automatically a defect — context can justify it. Heuristic evaluation complements but does not replace user testing.

**Severity scale (0–4)** — https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/
Severity combines three factors: **frequency** (common vs rare), **impact** (easy vs hard to overcome), **persistence** (one-time vs repeated). Rate each issue:
- **0** = Not a usability problem at all.
- **1** = Cosmetic only — fix only if spare time.
- **2** = Minor usability problem — low priority.
- **3** = Major usability problem — important, high priority.
- **4** = Usability catastrophe — imperative to fix before release.
Collect severity ratings *after* the finding phase (a separate pass), and average across evaluators — single-evaluator severity is unreliable; the mean of three is satisfactory.

**Cognitive walkthrough — and how it differs** — https://www.nngroup.com/articles/cognitive-walkthroughs/
Essence: A task-based method focused on **learnability for a new user**. At each step of a task, the team asks four questions:
1. Will users try to achieve the right result?
2. Will users notice that the correct action is available?
3. Will users associate the correct action with the result they want?
4. After acting, will users see that progress was made toward the goal?
If any answer is "No," that step fails.
Difference from heuristic evaluation (per NN/g's comparison table): perspective is the *new user* (vs the analyst); target is *learnability* (vs general usability); scope is *targeted tasks* (vs comprehensive); method is *exploring user reactions step by step* (vs judging the whole interface against guidelines).

---

### Chapter 4 — Mobile Ergonomics

**Touch-target minimums**
- Apple: a control needs a hit region of **at least 44×44 pt** (60×60 pt in visionOS). Sources: https://developer.apple.com/design/human-interface-guidelines/buttons and https://developer.apple.com/design/tips ("Create controls that measure at least 44 points x 44 points").
- Material Design (M3): make touch targets **at least 48×48 dp**, ≈9mm physical regardless of screen. Source: https://m3.material.io/foundations/designing/structure
- WCAG 2.2 SC 2.5.8 (AA): pointer targets **at least 24×24 CSS px**, or with sufficient spacing. Source: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
Consequence for this app (non-technical users, iPhone): treat 44pt as the floor and prefer more.

**Thumb zones and one-handed use** — https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/ (based on Steven Hoober's research)
Essence: ~49% of people hold their phone one-handed (Hoober); ~75% of interactions are thumb-driven (Josh Clark). The screen splits into easy-to-reach, hard-to-reach, and in-between zones. The bottom and centre are easiest; the top corners are hardest for the thumb.
Consequence: Put primary actions and navigation in the bottom, easy-reach band; avoid placing critical, frequent controls in the top corners.

**Navigation patterns** (same source): long link lists suit a full-screen overlay menu; short sets suit a sticky bottom menu (example cited: Airbnb's bottom sticky menu) which keeps key actions in the thumb zone.

---

### Chapter 5 — Forms and Data Entry

**Question pages / structure** — https://design-system.service.gov.uk/patterns/question-pages/
- Ask only what you truly need; know why you ask each question.
- Prefer **one question per page** — it focuses the user and helps screen-reader users (label/legend doubles as the page heading).
- Mark **optional** fields with "(optional)"; **never** mark mandatory fields with asterisks.
- Every question page needs a back link, a page heading, and a continue button. Label it **"Continue," not "Next,"** and left-align it.
- Never ask for the same information twice in a journey; pre-populate or offer carried-forward answers.
- Hint text: one short sentence, no full stop, no links inside it.

**Validation timing** — https://www.nngroup.com/articles/error-message-guidelines/
Essence: "Avoid prematurely displaying errors." Showing an error before the user has finished (or before they have even typed) is a hostile pattern.
Consequence: Validate a field after the user leaves it / finishes it, not on every keystroke.

**Error recovery** — https://design-system.service.gov.uk/components/error-message/
- **Do not clear the fields** when showing an error — keep both correct and incorrect answers so people can see and edit what went wrong.
- Put the message in red, after the label/hint, with a red border tying it to the field; also summarise all errors at the top (error summary).
- Be specific: avoid "An error occurred," "This field is required." Say what happened and how to fix it, echoing the label's wording ("Enter how many hours you work a week").
- Plain English only. Avoid jargon/codes, and avoid "please," "sorry," "valid/invalid," "oops."

**Forgiving input (for less-technical/older users)** — https://www.nngroup.com/articles/usability-for-senior-citizens/
Accept input in more than one format; don't punish hyphens, spaces or parentheses in phone/card numbers; let people type or speak values rather than forcing fiddly pickers.

---

### Chapter 6 — Content and Microcopy

**Plain language** — https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/
- Plain English is mandatory; even specialists prefer it (80% preferred clear English; preference rises with expertise and complexity).
- Use short, everyday words ("buy" not "purchase," "help" not "assist"). Avoid buzzwords and –ion/–ment nominalisations.
- Explain any necessary specialist term on first use.
- Use the words your users use (check real search terms — "lorry" vs "heavy goods vehicle").
- Be careful with contractions: "you'll" is fine, but negative contractions like "can't"/"don't" are often misread — prefer "cannot"/"do not" for critical instructions.
- Use "must" for requirements; use the active voice.

**Product-interface copy** — https://polaris.shopify.com/content/fundamentals (served as polaris-react.shopify.com/content/fundamentals)
- Weigh every word; only add copy that aids clarity. Ask "could this be an icon?"
- Keep it lean (the "Jenga" test — remove until it would break).
- Write like users talk; aim ~7th-grade reading level; read it aloud.
- Inspire action: focus on the one next thing, start sentences with verbs ("Add apps," not "You can add apps"), use size/position to signal importance, and break multi-part tasks into steps (progressive disclosure).
Consequence for this app: pick one term per concept and use it everywhere (terminology consistency = Heuristic 4). Quote UI strings in Hebrew, e.g. keep a single word for "expense," a single label for "all clear," etc.

---

### Chapter 7 — Accessibility and Inclusive Design

**Contrast** — https://webaim.org/articles/contrast/
- Text (AA, 1.4.3): **4.5:1** normal, **3:1** large. Large = 18pt/24px, or 14pt/18.67px if bold. You cannot round up (#777 at 4.47:1 fails).
- Non-text (AA, 1.4.11): **3:1** for UI component boundaries and meaningful graphical objects, measured against adjacent colours.
- Enhanced (AAA, 1.4.6): 7:1 normal / 4.5:1 large.
- Use of Colour (1.4.1): never convey meaning by colour alone. (See Chapter 8.)

**Target size** — WCAG 2.2 SC 2.5.8: 24×24 CSS px minimum (see Chapter 4 for platform figures).

**Designing for older / less-technical users** — https://www.nngroup.com/articles/usability-for-senior-citizens/
Essence: Ability to use websites declines ~0.8%/year between 25 and 60 — so this is not only about the over-65s. Common failures: tiny text, low contrast, small targets, inflexible/unforgiving input, and error messages that are obscure or easy to miss.
Consequence: Larger text and targets, high contrast, forgiving input, and error handling that "focus[es] on the error, explain[s] it clearly, and make[s] it as easy as possible to fix."

---

### Chapter 8 — Numbers and Finance UX

**Colour must never be the only signal** — https://webaim.org/articles/contrast/ (WCAG 1.4.1 Use of Color)
Essence: Information carried by colour alone excludes colour-blind users and misleads in bright light. In finance, green/red for gain/loss must be paired with a sign, arrow, icon, or label.

**Aligning amounts with tabular figures** — corroborated across typographic references: https://www.myfonts.com/pages/fontscom-learning-fontology-level-3-numbers-figures (tabular figures share one width, so they align vertically in tables, price lists and financial statements); https://typenetwork.com/article/opentype-at-work-figure-styles (use lining figures where numbers must align).
Essence: Use **tabular (fixed-width) lining figures** and **right-align** numeric columns so digits and decimal points line up; keep decimal places consistent (show trailing zeros). This makes ledgers and forecasts scannable and comparable.
Consequence for this app: the declared `tabular-nums` token is the correct choice — apply it wherever amounts stack or compare (ledger rows, forecast rows, equity figures).

**Trust and clarity (canon applied)**: Visibility of status (Heuristic 1) + Doherty (<400ms) build trust in a money app; a single clear number per moment (Aesthetic-Minimalist, Heuristic 8) is the calm-banking ideal; feedback on every committing action (Heuristic 5) reassures non-technical users handling financial data.

---

### Chapter 9 — RTL and Localization

**The definitive CSS/RTL guide** — https://rtlstyling.com/posts/rtl-styling/ (Ahmad Shadeed)
- Set `dir="rtl"` on the root; headings, paragraphs, links, images and form elements flip automatically. Flexbox and CSS Grid flip with the writing mode — a major benefit.
- **What flips** (RTL Design Considerations): back/next/previous and other order-based navigation, breadcrumb arrows, tab icon-vs-label order, horizontal card image/text order, toggle switches, page-header start/end sections, tables, menu ("more actions") button icons, and the send icon in messaging.
- **What never flips**: symmetrical icons; media playback icons (play/forward represent tape direction, not time — Spotify keeps them unflipped); email, phone-number and numeric inputs stay left-aligned (placeholder aligns right if it is Hebrew, then flips to left once typing a Latin/number value).
- Common mistakes: keep `letter-spacing: 0` for Arabic/Hebrew (letters must stay connected); avoid RGBa/opacity on text colour (rendering artifacts); allow for word-size differences (set `min-width` on short buttons); pick a proper RTL font; be consistent with numerals.

**Apple's official mirroring rules** — https://developer.apple.com/design/human-interface-guidelines/right-to-left
- System frameworks flip standard components automatically; fine-tune only where needed.
- **Never reverse the digit order within a specific number** — a phone number, credit-card number or "541" always reads in the same order. **Hebrew uses Western Arabic numerals** (0-9).
- Reverse the *order* of numerals that show progress/counting to match a flipped control — but never flip the numerals themselves.
- Flip controls that show progress (sliders, progress bars) and controls that navigate an ordered sequence (a back button points **right** in RTL). **Preserve** controls that refer to a real-world direction or point at an on-screen area.
- Align one/two-line text to the current context, but align a paragraph (3+ lines) to *its own language*. Don't flip photographs. Consider bumping Hebrew/Arabic font ~2pt when adjacent to all-caps Latin, so it doesn't look too small.

**Material Design bidirectionality**: (Not opened directly this session — see Gaps.) Its guidance aligns with the above (mirror layout and directional icons; keep numerals and media controls). Treat Apple HIG + rtlstyling.com as the primary authorities used here.

---

## PART 2 — THE EVALUATION INSTRUMENT

### How to run this

1. **Scope one thing at a time**: a single screen, or one 30-second interaction (per NN/g, narrow scope = better findings).
2. **Evaluate independently**, 3–5 people, before comparing notes. Do a learning pass, then an evaluation pass.
3. **Record evidence per finding**: screen, element, what you observed, which principle it relates to. One observation per line.
4. **Score severity 0–4** in a separate pass, then average across evaluators:
   - 0 = not a problem · 1 = cosmetic · 2 = minor (low priority) · 3 = major (high priority) · 4 = catastrophe (fix before release).
   - Weigh frequency × impact × persistence.
5. **Do not fix while scoring.** Consolidate and prioritise afterwards.
6. A violated item is a *candidate* problem — note context; confirm with user testing where it matters.

Each item: **the question** · *(principle → traceability)* · **what to look at**.

---

### Lens A — First impression & hierarchy

1. Is there one clearly dominant element (ideally one number/message) on first view? *(Aesthetic-Minimalist H8; Miller)* — Look at what the eye lands on first; count competing focal points.
2. Is the most important information visible without scrolling? *(H8; Serial Position)* — Check what sits above the fold on a standard iPhone.
3. Does visual weight (size, colour, position) match actual importance? *(Polaris "use design to communicate importance")* — Compare the biggest element to the user's real priority.
4. Is screen space free of repeated or redundant messaging? *(H8)* — Look for duplicated statements or stacked headers.
5. Are related items visually grouped by proximity and/or a shared container? *(Proximity; Common Region)* — Check spacing and card/background boundaries.
6. Is the number of choices on the screen kept to what's needed? *(Hick)* — Count simultaneous options/CTAs.

### Lens B — Navigation & orientation

7. Can the user always tell where they are in the app? *(H1)* — Look for a screen title / active tab indicator.
8. Is there always an obvious way out or back (cancel/undo/back)? *(H3)* — Check every screen for an exit.
9. Do primary navigation and key actions sit at the start/end (edges), not buried in the middle? *(Serial Position)* — Check nav order.
10. Do interface patterns match conventions users know from other apps? *(H4; Jakob)* — Compare to standard iOS/banking patterns.
11. Is terminology for the same concept identical everywhere? *(H4; Polaris)* — Track one concept's label across screens.
12. Are the same control types styled consistently for the same purpose? *(H4)* — Compare single-select controls, buttons, tags across screens.

### Lens C — Forms & input

13. Does the screen ask only for information that's truly needed? *(GOV.UK question pages)* — Question each field's necessity.
14. Is each field's label visible and does it stay visible while typing? *(H6; GOV.UK)* — Check for placeholder-only labels.
15. Are optional fields marked "(optional)" and mandatory ones left unmarked (no asterisks)? *(GOV.UK)* — Scan field labels.
16. Is the primary button clearly labelled with a verb ("Continue"/save action), not "Next"? *(GOV.UK; Polaris)* — Read the button.
17. Are good defaults and constraints used to prevent invalid entries? *(H5; Norman constraints)* — Check pickers, input types, pre-fills.
18. Does the form accept input in the formats users naturally type (e.g. spaces/hyphens in numbers)? *(NN/g older users)* — Try alternative formats.
19. Is information the user already gave never requested again? *(GOV.UK)* — Look for repeated asks across a flow.
20. Do input fields use the right mobile keyboard/type (numeric keypad for amounts, etc.)? *(H5; ergonomics)* — Tap each field, check keyboard.

### Lens D — Feedback, errors & recovery

21. Does every action with consequences produce immediate, visible feedback? *(H1; Feedback)* — Tap and watch for confirmation.
22. Does the system respond (or show progress) within ~400ms? *(Doherty)* — Time the response; check for skeletons/spinners on slow work.
23. Are validation errors shown *after* the user finishes a field, never prematurely? *(NN/g error guidelines)* — Type partial input, watch timing.
24. When an error appears, are the user's entered values preserved? *(GOV.UK)* — Trigger an error, check fields aren't cleared.
25. Are error messages plain-language, specific, and do they say how to fix it? *(H9; GOV.UK)* — Read the message; check for jargon/codes.
26. Are destructive/irreversible actions confirmed or undoable, and not triggered by an ambiguous icon? *(H3; H5)* — Find delete/remove actions; check for confirm or undo.
27. Is there a clear, single "success/complete" moment at the end of a task? *(Peak-End; H1)* — Complete a flow; observe the ending.

### Lens E — Content & microcopy

28. Would a non-technical family member understand every word without a glossary? *(H2; GOV.UK; Polaris)* — Read as a layperson.
29. Is any specialist/financial term explained on first use? *(GOV.UK)* — Note undefined jargon.
30. Is copy lean — nothing that could be removed without losing clarity? *(H8; Polaris)* — Try deleting each phrase mentally.
31. Are "empty" / "all clear" states phrased consistently across screens? *(H4)* — Compare wording of nothing-to-do states.
32. Do calls to action start with a verb and describe the outcome? *(Polaris)* — Read each button/link.
33. Are negative contractions avoided in critical instructions? *(GOV.UK)* — Look for "can't/don't" in key messages.

### Lens F —

---

> **NOTE (added at packaging time):** the source document was truncated at this point when handed over — Lens F onward is missing. Part 1 (the full primer, Chapters 1–9) and Lenses A–E (items 1–33) are complete and authoritative. Treat missing lenses as not provided; do not invent their contents. The measurable items for the live run are drawn from what exists here.
EMBED_UX_FOUNDATIONS
echo "✓  docs/audit/UX_FOUNDATIONS.md written (note: Lenses A–E; source was truncated after E)"
fi

# ---------- credentials check (the one thing this script will not touch) ----------
CREDS_OK=true
if [ -f .env.local ] && grep -q '^TEST_USER_EMAIL=' .env.local && grep -q '^TEST_USER_PASSWORD=' .env.local; then
  echo "✓  Test-account credentials found in .env.local"
else
  CREDS_OK=false
  echo ""
  echo "⚠️   MISSING: test-account credentials in .env.local"
  echo "    Add these two lines (your staging test account) for full live testing:"
  echo "        TEST_USER_EMAIL=..."
  echo "        TEST_USER_PASSWORD=..."
  echo "    Without them the run still works — it degrades to full code-side audit + fixes,"
  echo "    and says so honestly in the morning report."
  echo ""
fi

# ---------- launch ----------
LAUNCH_PROMPT="Read NIGHT_RUN.md and execute it end to end. If docs/audit/RUN_STATE.md exists, resume from it."

if ! command -v claude >/dev/null 2>&1; then
  echo "❌  'claude' CLI not found on PATH. Open Claude Code here and paste:"
  echo "    $LAUNCH_PROMPT"
  exit 1
fi

echo ""
echo "🚀  Launching the night run now."
if [ "$CREDS_OK" = false ]; then
  echo "    (starting in 8s — Ctrl-C to abort and add credentials first)"
  sleep 8
fi

if command -v caffeinate >/dev/null 2>&1; then
  exec caffeinate -dims claude --dangerously-skip-permissions "$LAUNCH_PROMPT"
else
  echo "ℹ️   'caffeinate' not found (not macOS?) — make sure the machine will not sleep."
  exec claude --dangerously-skip-permissions "$LAUNCH_PROMPT"
fi
