# ניהול דירה — דלת-הכניסה

אפליקציית ווב מותקנת (PWA) בעברית, מימין-לשמאל, מותאמת-טלפון, לניהול השקעה בדירה מושכרת אחת.
נבנית ב-React עם Supabase; כל דחיפה לגיט נפרסת אוטומטית לאתר החי (עם השהיית-בנייה קצרה — אם תיקון "לא עובד", חשוד קודם בהשהיה/מטמון ולא בקוד).

## 🎯 המוקד הנוכחי
שחרור למשפחה → הרשימה החיה: **ROADMAP.md** (סעיף "עכשיו"). המפה היא מקור-האמת היחיד לעדיפויות.

## הקצב
- פתיחת סשן: **/kickoff** — מושך מגיט, קורא את המפה, מציע במה לעבוד.
- סיום סשן: **/wrap** — מעדכן את המפה (כולל "איך אומת"), מוודא שמירה-ודחיפה.

## הסכם-העבודה
- עברית בלבד בתשובות; מונחים טכניים מתורגמים.
- שמירה ודחיפה אוטומטית אחרי כל שינוי קוהרנטי — בלי לשאול.
- אצווה של עריכות → בנייה פעם אחת → דחיפה פעם אחת. אימות מידתי: לשינוי קטן מספיקה בנייה עוברת; בדיקה חיה רק לשינויי-לוגיקה.
- ימין-לשמאל טבעי: התחלה = ימין; שברון-חזרה ימני-עליון; כפתור ראשי ברוחב מלא; התקדמות מימין לשמאלה.
- תאריכים: אך ורק עזרי-התאריך המקומיים ב-`src/lib/format` — לעולם לא חיתוך של תאריך בינלאומי (בעיית אזור-זמן ישראל).
- כסף: לעולם לא לספור פעמיים שכר-דירה/משכנתא (תנועת-אמת גוברת על שורת-תחזית); קטגוריות רק מקובץ-הקבועים `src/lib/constants`.
- חלונות-קופצים: רק הרכיב `components/ui/Modal` — לא שכבה קבועה בטלפון.
- פקודות לבעלים: תמיד שורה אחת שלמה ומוכנה-להדבקה (כולל מעבר לתיקיית-הפרויקט).

## גבול-האוטונומיה
- 🟢 **בטוח** — קלוד מבצע ודוחף לבד: תיקוני עיצוב/ריווח, עקביות, בדיקות, שינוי זהה-התנהגות, תקלים ברורים, סקירות ודוחות.
- 🔴 **דורש-בעלים** — הכנה בלבד ועצירה: מחיקות ומיגרציות, החלטות מוצר/עיצוב פתוחות, נגיעה מהותית בחישובי-כסף, וכל מקרה של ספק.

## איפה מה
- `ROADMAP.md` — הרשימה החיה (מקור-האמת לעדיפויות).
- `SKILL.md` — ארכיטקטורה, הרצה ומוסכמות-קוד (באנגלית).
- `QA_MASTER_CHECKLIST.md` — צ׳קליסט-הבדיקות הפעיל.
- `docs/handoff/` — תיאור-האפליקציה לשותף-החשיבה בצ׳אט (עברית).
- בדיקות: `npm test` (אזור-הזמן של ישראל מוגדר בסקריפט).

---

# Cold-start guide (English) — for a zero-context session in a fresh clone

Everything below is written for someone who just cloned this repo into an empty
environment and cannot ask the owner anything. The Hebrew section above is the
project's working agreement; this section is the technical ground truth.

## What this is
A Hebrew, right-to-left, mobile-first installable PWA for managing the finances of
one rented investment apartment: rent, mortgage (multi-track, grace periods), extra
loans (incl. balloon), insurance, documents, tasks, and a wealth/equity view. Single
owner today; being hardened for a small family rollout (each family member gets their
own isolated apartment). Not a multi-tenant SaaS — data is per-user, isolated by
Supabase row-level security (`owner_id = auth.uid()`).

## Stack & architecture
- **Frontend:** React 19 + TypeScript + Vite. Router: react-router-dom. Icons:
  @phosphor-icons/react. No CSS framework — hand-written CSS in `src/index.css` +
  per-page `.css`, themed via CSS custom properties (light/dark via `data-theme`).
- **Backend:** hosted **Supabase** (Postgres + Auth + Storage + Edge Functions).
  Project ref `bjholzkesnzkbogxmurw` (see `supabase/config.toml`). There is **no
  local database** — the app talks to the hosted project. Schema lives in
  `supabase/migrations/` (47 tracked SQL files). Server logic lives in
  `supabase/functions/` (13 Deno edge functions: doc-extraction `extract-*`,
  `daily-reminders` push cron, and the feedback→Claude autofix pipeline).
- **Deploy:** frontend → **Cloudflare Pages** via `wrangler` (see `.github/workflows/`).
  Git push auto-deploys (short build delay — if a just-pushed fix "doesn't work,"
  suspect the build delay / stale PWA cache before the code). DB migrations and
  function deploys are done **manually** by the owner with the Supabase CLI; no CI
  deploys the backend.

## Directory layout
- `src/pages/` — screens by pillar: `dashboard/` (Home), `finances/`, `wealth/`,
  `liabilities/`, `property/`, `documents/`, `tasks/`, `admin/`, `legal/`, plus
  `Login.tsx`, `Onboarding.tsx`, `Settings.tsx`.
- `src/components/` — `ui/` (Modal, BottomSheet, DateField…), `layout/`,
  `onboarding/` (the 9-step wizard: state in `useOnboardingState.ts`, one component
  per step), `capture/` (quick expense/task sheets).
- `src/lib/` — money & domain logic: `mortgage.ts`, `loans.ts`, `equity.ts`,
  `projections.ts` (keep these rounding-free; round only at display), `format.ts`
  (date/currency helpers — ALWAYS use these, never `toISOString().slice`), plus
  `constants.ts` (the only source of categories), `supabase.ts`, `push.ts`, `admin.ts`.
- `src/hooks/` — data-fetching hooks (`useDashboardStats`, `useTransactions`, …).
- `src/types/index.ts` — the domain types; keep in sync with migrations.
- `supabase/migrations/`, `supabase/functions/` — the backend, fully in git.
- `e2e/` — Playwright specs + `e2e/lib/` helpers (audit infra). `scripts/audit/` —
  stress seed/cleanup + DB assertion helpers.
- `docs/audit/`, `docs/reviews/`, `docs/handoff/` — audit state, review reports,
  chat-partner app description. `ROADMAP.md` — the live priority list (source of truth).

## Install, run, test — from a clean clone
Requires **Node 22** (pinned in `.nvmrc`; CI uses 22). Lockfile is committed.
```
npm ci                         # install exact locked deps (needs Node 22)
cp .env.example .env.local     # then fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev                    # vite dev server on http://localhost:5173
npm test                       # unit tests (Vitest, TZ=Asia/Jerusalem — 140 tests)
npm run build                  # tsc -b && vite build (bundles even without env; the
                               #   built app throws at LOAD if Supabase env is missing)
npm run lint                   # eslint
```
E2E (optional): `npm i -D @playwright/test && npx playwright install webkit chromium`,
then `npx playwright test`. The dev-bypass auto-login (set `VITE_DEV_BYPASS_AUTH=true`
+ `VITE_DEV_USER_EMAIL`/`VITE_DEV_USER_PASSWORD` in `.env.local`) lets specs start
authenticated. Backend from scratch (only if not reusing the hosted project):
`supabase link --project-ref <ref>` → `supabase db push` → `supabase functions deploy`
→ set every function secret (see `.env.example` footer) in the project dashboard.

## Conventions & non-obvious things
- **Dates:** Israel is UTC+2/+3. Use `todayISO`/`monthDayISO`/`monthEndISO` from
  `src/lib/format` for anything stored/compared. Never `new Date().toISOString().slice(0,10)`.
- **Money:** never double-count rent/mortgage (a real transaction overrides its
  forecast row). Categories come only from `src/lib/constants`. Core money math in
  `src/lib/*` carries full float precision; round only at the display boundary.
- **RTL:** start = right; back chevron top-right; full-width primary CTA; progress
  flows right→left. Use logical CSS properties, not physical left/right.
- **Modals/sheets:** only `components/ui/Modal` / `BottomSheet` (portal + scroll-lock);
  never a fixed overlay on mobile. Add/edit sheets close with a discard-confirm when dirty.
- **PWA freshness:** a build id (`__BUILD_ID__`) + `/version.json` poll drive an update
  banner — the #1 support pain is a stale installed-PWA cache, so suspect that first
  when a shipped fix "doesn't show."
- **Env safety:** every `VITE_*` var is inlined into the public bundle — never put a
  real secret in one. `build:prod` blanks the dev-login vars as a guard.

## CURRENT STATUS (as of this readiness pass, 18.07.2026)
- **Works:** onboarding (9-step wizard), Home/Finances/Wealth/Property hubs, add/edit
  transactions, tasks (recurring, date+time), documents + checklist, mortgage/loan/
  insurance modeling with grace & balloon, dark mode, web push, a feedback→Claude
  auto-fix pipeline. Unit suite green (140), build green, TypeScript clean.
- **Branches:** `staging` is the active line (build → owner verifies in a testing app
  → "פרסם לכולם" promotes to `main`/production). `main` is production. Feature branches
  `feat/extract-rate-limit`, `feat/feedback-autofix-pipeline`, `fix/onboarding-atomicity`
  are prepared/merged work. `chore/remote-readiness` is this readiness pass.
- **In progress:** a smoothness/correctness audit on `staging` — Stage 0–1 done
  (calibration, e2e infra, money-correctness verified, 2 fixes shipped: AUD-001
  onboarding-fabrication P1, AUD-002 nav-overlap P2). Resumable state and the full
  findings ledger are in `docs/audit/RUN_STATE.md`; morning summary in
  `docs/audit/MORNING_REPORT.md`. Next: audit stages 2–7 (layout/a11y, smoothness,
  resilience, code quality, design golden list).
- **Next / open:** live privacy re-verification after recent migrations; the next
  "promote to everyone"; testing real family documents through extraction. See `ROADMAP.md`.

## IN-FLIGHT WORK — another session is editing this repo right now
A second Claude Code session is actively running the audit above on `staging`,
committing as it goes (working tree stays clean). It touches `docs/audit/*`, `e2e/*`,
and `src/` files it fixes. **To pick up its work, read `docs/audit/RUN_STATE.md`** —
it holds the stage list, coverage matrix, findings ledger, and the exact next action.
Do not force-push or rewrite `staging`; coordinate through git as it does.

