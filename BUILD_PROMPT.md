> **מסמך היסטורי** — הושלם ברובו; שמות-הקבצים כאן ישנים (המסכים הוחלפו מאז). הרשימה החיה: `ROADMAP.md`.

# Build Prompt — Apartment UX/UI overhaul

> Paste everything below into a **new chat**. It is self-contained.

---

You are working on **Apartment (ניהול דירה)**, a Hebrew (RTL), mobile-first React app for a **private real-estate investor managing a single rental property**. Stack: React 19 + TypeScript + Vite, React Router DOM 7, Supabase, `@phosphor-icons/react`. Design tokens live in `src/index.css` (CSS custom properties: `--accent` teal, `--success`, `--danger`, spacing `--s-*`, radius `--r-*`, shadows). The user tests on their phone; verify at ~375px width.

**Working rules (important):**
- **Edit files directly. Do NOT spawn subagents** — the user has explicitly said subagents are too slow/expensive for this kind of focused work.
- Keep verification light: one screenshot per change to confirm, not click-by-click probing.
- Hebrew RTL throughout. Match the existing design tokens; do not introduce a new visual style.
- Commit and push automatically after each coherent change (the user expects this).
- Preserve all business logic noted in "Do not regress" below.

A full UX review is in `UX_REVIEW.md` — read it for rationale. This prompt is the actionable build list, in priority order. **Do the P0 items first, verify each, commit, then continue.** Confirm with the user before starting P1 if you want, but P0 is approved.

---

## P0 — Structural (highest impact)

### 1. Merge Dashboard + Property/Overview + Investment-summary into one Home screen
Today the same facts (equity, monthly cash flow, gross yield, total invested, rent received) are computed in 3–4 places: `src/pages/Dashboard.tsx`, `src/pages/property/Overview.tsx`, `src/pages/property/Investment.tsx`.

- Make **`Dashboard.tsx` the single source** for the at-a-glance view. It should contain, top to bottom:
  1. Equity hero + own/debt bar (already there — keep).
  2. **One** monthly cash-flow card (rent − mortgage − insurance = net). Reuse the Investment page's `inv-flow` layout, including the grace toggle when `tracks` have grace months.
  3. Yield + invested + rent-received metrics row (already there — keep, but see naming fix #5).
  4. The **equity-buildup sparkline** moved here from Investment (`Investment.tsx:220`), placed right under the hero (same story as the hero).
  5. "דורש תשומת לב" attention list (keep).
  6. "תנועות אחרונות" recent activity (keep).
- Delete the duplicate monthly-flow block that's redundant once consolidated.
- Keep the per-section skeleton loading pattern.

### 2. Flatten the Property hub from 6 sub-tabs to one scrollable page
`src/pages/property/PropertyHub.tsx` currently renders 6 `NavLink` sub-tabs (סקירה/נכס/משכנתא/שכירות/ביטוח/תשואה).

- **Remove the "סקירה" (Overview) sub-tab entirely** — its content now lives on Home.
- Convert the hub into **one scrollable page with collapsible accordion sections** (one open at a time): נכס (details), משכנתא (mortgage), שכירות (rental), ביטוח (insurance), עלויות השקעה (the cost editor from Investment).
- Each section's existing component (`Details`, `Mortgage`, `Rental`, `Insurance`, and the cost-editor portion of `Investment`) renders inside its accordion panel. Keep their internal logic intact; you're only changing how they're mounted/navigated.
- Update routing in `src/App.tsx` accordingly (remove the per-sub-tab routes, or redirect them to the single page + anchor). Keep deep-link redirects working so existing links (`/property/mortgage`, etc.) don't 404 — redirect to the page with the right section expanded.

### 3. Convert wide tables to mobile card/list layouts
Reuse the clean `gtask-item` list pattern from `src/pages/Tasks.tsx`.
- **`src/pages/Finances.tsx`** (6-col table, line ~409): stacked rows — date + category on line 1, amount right-aligned (colored by direction), description/payment-method muted below; edit/delete/receipt as trailing icon buttons. Keep the "מחושב" virtual rows but render them with a subtler treatment (dashed start-border + lighter text) instead of a per-row badge.
- **`src/pages/RecurringItems.tsx`** (8-col table, line ~272): card/list — category + payee as title; amount + "יום X בחודש" as meta; execution-type badge; edit/delete actions. Keep the income/expense section split.

### 4. Gate dev-only tools out of production
- `src/pages/Settings.tsx` "פיתוח ובדיקה → איפוס כל הנתונים" (delete-all, line ~98): wrap the whole section in `import.meta.env.DEV` so it never ships to the user.
- `src/pages/Onboarding.tsx` "מלא דוגמה" fill buttons: confirm they're `import.meta.env.DEV`-gated; if not, gate them.

---

## P1 — Clarity & consistency

### 5. Unify terminology
- "נטו חודשי" / "מאזן" / "מצב נקי מצטבר" all mean different-scoped "net." Label each by scope: monthly → "נטו חודשי", period → "מאזן התקופה", lifetime → "מצב נקי מצטבר". On Home/Dashboard rename cumulative "שכ״ד שהתקבל" to "שכ״ד שנגבה (מצטבר)" so it's not confused with monthly "שכ״ד חודשי".
- Pick **one app name** and use it in all three spots: sidebar title (`index.css`/`Layout.tsx`), Login (`Login.tsx:22`), and the Property header. Recommend "ניהול דירה".

### 6. Rename "תשואה" / relocate yield
- The yield % now lives on Home (item 1). The former Investment page's cost editor becomes the "עלויות השקעה" accordion section in the Property page (item 2). There is no longer a standalone "תשואה" tab.

### 7. Make "+ תנועה" open the add form
- Dashboard quick-action "+ תנועה" (`Dashboard.tsx:274`) currently just navigates to `/finances`. Pass router state to auto-open the new-transaction modal (Finances already reads `location.state.prefill` — extend that to also accept an `openForm` flag, or reuse prefill with empty values).

### 8. Standardize delete-confirm and add/edit patterns
- Replace native `confirm()`/`alert()` deletes (`Finances.tsx:234`, `Tasks.tsx:92`, `Insurance.tsx:147`, `Documents.tsx:90`, `RecurringItems.tsx:118`) with the **inline two-step confirm** pattern already used in Mortgage (`Mortgage.tsx:389`).
- Convention to follow going forward: **modal** for creating a new entity; **inline** for quick-add to a list (Tasks). Don't introduce new patterns.

---

## P2 — Polish (only after P0/P1 land)
9. Collapse the mortgage amortization table (`Mortgage.tsx:864`) behind a "הצג לוח סילוקין" disclosure — it's reference data.
10. Replace the hand-rolled receipt-link SVG (`Finances.tsx:445`) with a Phosphor icon; change number formatting from `toLocaleString('en-US')` to `'he-IL'` in amount inputs.
11. Friendlier data-fetch error states with a retry button (currently bare `form-error` strings).
12. Surface documents in context — show a rental contract on the Rental section, insurance policy on Insurance — instead of only in the Documents archive.

---

## Do NOT regress (preserve this behavior/logic exactly)
- Equity hero + own/debt bar.
- Per-section skeleton loading.
- Onboarding grey-placeholder computed-defaults UX and partial-save resilience.
- Tasks inline-add list + the "task done → offer to log transaction" automation (`Tasks.tsx:102`).
- Mortgage math: prime/margin split, grace-period handling, amortization schedule (`src/lib/mortgage.ts`).
- Finances "actual overrides projected" virtual-entry logic (`src/lib/projections.ts`) — change only its visual treatment, not the logic.
- The `index.css` design-token system.

## Verification
After each P0 item: run the dev server, view at 375px, take one screenshot, confirm it renders and the flow works. Then commit + push. Report a one-line summary per item.
