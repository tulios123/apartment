# Remote-readiness audit — 18.07.2026

Written before this machine goes offline for months. Question answered: **can this
repo build and run in a clean cloud environment with no access to this machine?**
Short answer: **yes, with the env vars below** — nothing is stranded, no secret is in
git. Details and the few sharp edges follow.

## Secrets — verdict: NO secret is tracked in git ✅
Verified by `git ls-files` + `git grep` for JWT/`sk-ant-`/`sk-`/`service_role`/private-key
patterns across all tracked files.
- Real secrets on disk (`.env.local`, `.claude/settings.local.json` — they hold
  `SUPABASE_ACCESS_TOKEN=sbp_…`, `ANTHROPIC_API_KEY=sk-ant-…`, a dev password) are
  **untracked** and stay on this machine only. They are lost when it dies — that's
  fine, they're regenerable (Supabase dashboard / Anthropic console).
- The only JWT-shaped string in tracked code (`scripts/test-e2e.mjs`) is the **public
  anon key** (`role:"anon"`), safe by design.
- **Fix applied this pass:** `.claude/settings.local.json` was ignored only by this
  machine's *global* gitconfig — that protection would not travel to a fresh clone.
  Added repo-level `.gitignore` rules (`.env`, `.env.*`, `!.env.example`,
  `.claude/settings.local.json`) so the token file can never be accidentally committed
  from any clone.

## What a cold clone needs (and what breaks without it)
| Need | Status | Notes |
|---|---|---|
| Node **22** | pinned this pass (`.nvmrc`) | was unpinned; CI already used 22. No `engines` field (adding one means editing the shared `package.json` — left for the owner). |
| Lockfile | ✅ tracked (`package-lock.json`, v3) | `npm ci` gives exact deps. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | must be supplied | app throws at load without them (`src/lib/supabase.ts`). `cp .env.example .env.local` and fill. Pointing at the hosted project reuses its data. |
| Other `VITE_*` | optional | full list + descriptions in `.env.example` (now complete — was missing 7 of 11). |
| Absolute paths | ✅ none in tracked code | only in prose docs and in the untracked `setup-night-run.sh`. |

## Local-only / cloud-hostile dependencies
| Thing | Where | Cloud alternative |
|---|---|---|
| **Hosted Supabase** (not local) | `supabase/config.toml`, `VITE_SUPABASE_URL` | Backend is a hosted project (`bjholzkesnzkbogxmurw`). A clone pointed at it inherits live schema+data. To stand up an independent copy: `supabase link` → `db push` (47 tracked migrations) → `functions deploy` (13 tracked functions) → set every function secret (see `.env.example` footer). |
| **Supabase CLI** | manual migration/function pushes | Not an npm dep — install separately (`brew install supabase/tap/supabase` or the cloud equivalent). Needs `SUPABASE_ACCESS_TOKEN`. |
| **`tsx`** | `scripts/audit/*.ts` shebang | Pulled via `npx tsx` on demand (needs network). Could be added as a devDependency. |
| **Playwright browsers** | `e2e/*`, `scripts/verify.cjs` | `npx playwright install webkit chromium` after `npm i`. |
| **`caffeinate`** (macOS) | only in untracked `setup-night-run.sh` | Not in the repo; degrades gracefully anyway. No other macOS-only commands in tracked code. |
| **`gh` CLI** | `.github/workflows/*` | Provided by GitHub's `ubuntu-latest` runners automatically. |
| **`wrangler`** (Cloudflare Pages deploy) | `npm run deploy`, workflows | Pinned devDependency; needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. |
| **daily-reminders cron schedule** | not in tracked SQL | The push-reminder cron trigger lives in the Supabase dashboard, not in migrations — not reproducible from git alone. Re-create it in the new project's dashboard if standing up a fresh backend. |

## Build / run / test (clean clone)
```
npm ci
cp .env.example .env.local        # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev                       # http://localhost:5173
npm test                          # 135 unit tests, TZ=Asia/Jerusalem
npm run build                     # bundles; app needs the Supabase env to run
```

## Not preserved to GitHub (deliberate)
- **`צילומי מסך 16:7/`** — 24 iPhone screenshots (5.6 MB), the source evidence for
  `docs/audit/DESIGN_UX_REVIEW.md`. They show the owner's **real apartment finances**,
  so they were NOT auto-pushed (pushing personal financial data to a remote is hard to
  reverse). They exist only on this machine and are lost when it dies unless the owner
  chooses to preserve them. See the chat report.
