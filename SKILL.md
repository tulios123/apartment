---
name: apartment-app
description: Run, verify, and develop the Hebrew RTL apartment-management web app (React + Vite + Supabase). Use for any task touching this codebase — features, bug fixes, UI/UX, or verification.
---

# Apartment App

A single-property Israeli investment-apartment manager. Hebrew, **RTL**, mobile-first. Stack: React + TypeScript + Vite, Supabase (Postgres + Auth + Storage), React Router. No UI framework — plain CSS in `src/index.css` with CSS variables. Zero-dependency SVG charts in `src/components/ui/`.

## When to use

Any work in `/Users/itaishubi/ai/Apartment`: adding features, fixing bugs, UI/UX changes, or verifying behavior.

## Architecture

- **Nav (6 items):** ראשי (Dashboard) · הנכס (PropertyHub) · כספים (FinancesHub) · משימות · מסמכים · הגדרות. Desktop sidebar becomes a bottom tab bar ≤640px.
- **Hubs (nested routes + NavLink tabs):**
  - `/property` → `PropertyHub.tsx`: סקירה (Overview) · נכס (Details) · משכנתא (Mortgage) · שכירות (Rental) · ביטוח (Insurance) · תשואה (Investment). Old `/mortgage`, `/investment` redirect in.
  - `/finances` → `FinancesHub.tsx`: תנועות (ledger) · קבועים (RecurringItems).
- **Data hooks** (`src/hooks/`): `usePropertyData` (property + contracts + utilities), `useMortgageData` (tracks + amortization `combined` + `summary`), `useInvestmentData`, `useInsurance`, `useDashboardStats`, `useTransactions`, `useTasks`, `useRecurringItems`, `useDocuments`.
- **Shared logic** (`src/lib/`): `mortgage.ts` (Shpitzer schedule, `monthlyPayment`, `combineSchedules`, `gracePeriodPayment`, `interestToDate`), `projections.ts` (`rentReceivedToDate`, `monthlyVirtualEntries`, `elapsedMonths`, `insurancePaidToDate`, `activeContract`), `constants.ts` (canonical category sets), `format.ts` (`formatCurrency`, `formatNum`).
- **UI primitives** (`src/components/ui/`): `Skeleton`, `EmptyState`, `BarChart`, `Sparkline`.

## Run it

```bash
npm install        # first time
npm run dev        # Vite on http://localhost:5173 (host:true → also on LAN + tunnels)
```

**Dev auth bypass:** `.env.local` has `VITE_DEV_BYPASS_AUTH=true` + `VITE_DEV_USER_EMAIL/PASSWORD` — the app auto-signs-in as a dev user, so it loads straight to the app (or onboarding if no property exists). No Google login needed locally.

**Phone access:** same WiFi → `http://<LAN-IP>:5173` (`ipconfig getifaddr en0`). Different network → `cloudflared tunnel --url http://localhost:5173` (quick tunnels are flaky; `vite.config.ts` already sets `allowedHosts:true`).

## Verify (always do this for UI/behavior changes)

Run `npx tsc --noEmit` (must be clean), then drive the **running app** with Playwright at a phone viewport — don't just unit-test.

```js
// node <script>.cjs  (package is ESM, so use .cjs; run from project dir so node_modules resolves)
const { chromium } = require('playwright');
const ctx = await browser.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
// SPA route nav without reload:
await page.evaluate(p => { history.pushState({},'',p); dispatchEvent(new PopStateEvent('popstate')); }, '/property/mortgage');
```

- **No horizontal overflow:** assert `window.innerWidth === 393 && document.documentElement.scrollWidth === 393` per route (wide tables must scroll inside `overflow-x:auto`, never widen the page).
- Screenshot full-page and **look at it**. Data hooks are slow — wait ~5s before asserting loaded content (a `.skeleton` means still loading).
- Reset data from **הגדרות → איפוס כל הנתונים → מחק הכל** (it `window.location.reload()`s itself; deletes all owner-scoped tables).

## Conventions & gotchas

- **Source of truth:** monthly rent lives in `contracts.monthly_rent`; the mortgage lives in `mortgage_tracks` (never a recurring item). `projections.ts` derives **virtual** ledger rows from these.
- **Never double-count:** when summing real transactions + virtual rows, exclude real txns whose category ∈ `RENT_CATEGORIES` (income) / `MORTGAGE_CATEGORIES` (expense) before adding virtuals. Mirror `useDashboardStats`.
- **Categories:** use the constants in `constants.ts`, never bare Hebrew literals (drift breaks the dedup filter).
- **Numbers:** display with `formatCurrency`; comma-format numeric inputs with `formatNum` (store clean digits via `.replace(/\D/g,'')`).
- **Yield:** gross yield = annual rent ÷ property value; cash-on-cash = annual rent ÷ total invested. Keep them distinct.
- **resetAllData** must delete **every** owner-scoped table (incl. `insurance_policies`, `contracts`) or rows accumulate across re-onboards.
- Commit & push automatically (project preference); end commit messages with the Co-Authored-By trailer.
