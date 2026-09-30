> ⚠️ **Active branch is `staging`, not `main`.** In a fresh cloud session run
> `git fetch origin staging && git checkout staging` before doing anything —
> some environments only clone `main`, and all readiness work lives on `staging`.

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
- **קודם להסכים, אחר-כך לבנות** (הבעלים, 26.07): במשימה שהיא לא תיקון-קטן-וברור — קודם לנסח בחזרה מה הבנתי, להציף את ההחלטות הפתוחות, ולקבל אישור. רק אז לכתוב קוד. עדיף סבב-הבהרה קצר מאשר לבנות דבר לא-נכון ולגלות אחרי.
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
**Cloud session?** `scripts/dev/trust-proxy-ca.sh` runs at session start (.claude/settings.json)
and imports the agent proxy's CA into the browser's NSS store. Without it Chromium reaches
localhost fine and fails every Supabase call with ERR_CERT_AUTHORITY_INVALID, landing on the
login screen with nothing that points at a certificate — which is what made the live-backend
specs look permanently unrunnable. The store is per-container and the CA rotates, so this
re-imports every run. Verification stays on; this is not --ignore-certificate-errors.

E2E (optional): `npm i -D @playwright/test && npx playwright install webkit chromium`,
then `npx playwright test`. Five specs drive the HOSTED Supabase through the dev-bypass
login rather than the offline stub (preflight, layoutcheck, onboarding, reset); of those,
onboarding and reset DELETE the test account's data, so `resetAccount` refuses unless
`E2E_ALLOW_DESTRUCTIVE=1`. The dev-bypass auto-login (set `VITE_DEV_BYPASS_AUTH=true`
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

## CURRENT STATUS (29–30.09.2026)

- **Live version:** v1.21.7. `main` and `staging` are the same commit; both deploy on push
  (staging → staging.apartment-6s4.pages.dev, main → apartment-6s4.pages.dev). The DB is
  ONE hosted project shared by both — there is no such thing as "staging data".
- **Works:** onboarding (9-step wizard, ending on a review screen — see below), Home /
  Finances / Wealth / Property hubs, transactions, tasks, documents + checklist, mortgage /
  loan / insurance modelling with grace & balloon, dark mode, web push, the feedback→Claude
  autofix pipeline, and **shared apartments** (up to 3 people, `member` / `viewer`, invite
  by email, switch between apartments). 306 unit tests, 130 e2e, build and TypeScript clean.
- **The audit is DONE.** Stages 0–8 all completed 18.07 — `docs/audit/RUN_STATE.md` is the
  ledger. (The old copy of this block said stages 2–7 were still ahead; that was wrong and
  cost a session the trouble of rediscovering it.)

### What the backend can do without the owner
Migrations, SQL reads and function deploys all run from CI with the stored
`SUPABASE_ACCESS_TOKEN` — nothing here needs the owner at a keyboard:
- `.github/workflows/db-migrate.yml` — apply ONE named migration. Gated on
  `scripts/rls/verify.sh` passing, and on the file surviving being applied twice
  (`RERUN_CHECK`). `record_only: true` writes the ledger row and runs no SQL — use that when
  the database already has the change, because replaying an old file is a DOWNGRADE (052
  carries its own `accept_invite` and would reinstate the bug 054 fixes).
- `.github/workflows/db-inspect.yml` — read-only, fixed queries, masked addresses. Reach for
  this before theorising about live data; it turned "why can't he see the invitation" from a
  three-guess mystery into one answer.
- `supabase_migrations.schema_migrations` is now in step with the database (054).

### Browser access from a cloud session
`scripts/dev/trust-proxy-ca.sh` runs at session start (`.claude/settings.json`) and imports
the agent proxy's CA into Chromium's NSS store. Without it the app loads from localhost and
every Supabase call fails with `ERR_CERT_AUTHORITY_INVALID`, landing on the login screen
with nothing that points at a certificate. The store is per-container and the CA rotates, so
it re-imports every run. **Verification stays on** — never `--ignore-certificate-errors`.

With that in place the whole suite runs here: 123 passed / 7 skipped. Five specs drive the
HOSTED Supabase (preflight, layoutcheck, onboarding, reset); onboarding and reset DELETE the
test account's data, so `resetAccount` refuses without `E2E_ALLOW_DESTRUCTIVE=1`. The
dev-bypass account is `dev@test.local`, NOT the owner's.

### Sharing — where it actually stands
The code path works end to end and is proved by `scripts/rls/verify.sh` (52 assertions on a
real Postgres). **But no human has ever completed a join.** As of 29.09 the database held 10
households, every one of them a household of one, and exactly one invitation ever written —
which `accept_invite` had marked used without adding anybody (fixed in 054, and that
invitation was reopened). Moran has never been invited. Treat the feature as unproven in the
field until a second real person is inside an apartment.

### Known debt
- Three controls still under the 44pt tap floor: `/` `.hs-link` "פירוט" (33×15),
  `/property` `.padm-binder-edit` (77×32) and `.btn-primary` "+ חוזה חדש" (110×39). Each
  needs a layout decision, not a `min-height` — `.btn-primary` is shared app-wide.
- `npm run lint`: 97 problems (29 errors). Pre-existing; measure against this number rather
  than assuming a change introduced them.
- Owner-side, not code: nobody has invited Moran, and the Auth redirect allow-list should be
  confirmed to include staging as well as production.

### A caution this repo earned the hard way
The offline e2e stub (`e2e/lib/stub.ts`) deliberately DROPS `owner_id` / `user_id` filters.
That is the right default — a per-screen fixture is one user's data by construction — but it
means a spec about who-can-see-what passes against broken code. It produced three false
readings in one session. When a spec's subject is visibility or permissions, re-route the
table yourself (see `e2e/joined-flat-boot.spec.ts`) or test it in the RLS rig instead.
