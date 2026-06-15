# UX / UI Review — Apartment (ניהול דירה)

**Reviewer lens:** world-class mobile product designer.
**Target user:** a private real-estate investor managing a single rental-property investment.
**Scope:** entire app — every screen, navigation, flows, onboarding, forms, states, visual system, IA.
**Constraint understood:** the user owns *one* property (the model is single-property today). The whole product should feel like "the cockpit for my one investment," not a generic multi-property CRM.

---

## 0. The one-sentence verdict

The app is well-built and visually clean, but it is **organized like a database, not like an investor's mental model.** The same three facts — *what's my equity, what's my monthly cash flow, what's my return* — are computed and shown in 3–4 different places under 3–4 different names, while the navigation makes you dig through two layers of tabs to reach them. The biggest wins are **consolidation and naming**, not new features.

---

## 1. Top themes (the issues that recur everywhere)

### T1 — Redundant information architecture (highest impact)
Monthly cash flow is rendered **three times**, each slightly differently:
- Dashboard → "תזרים החודש" (rent / expenses / net, 3 cards) — [Dashboard.tsx:154](src/pages/Dashboard.tsx:154)
- Investment → "תזרים חודשי" (rent − mortgage − insurance = net, with grace toggle) — [Investment.tsx:174](src/pages/Investment.tsx:174)
- Overview → the four cards effectively restate the same monthly numbers — [Overview.tsx:37](src/pages/property/Overview.tsx:37)

Likewise **equity** appears on the Dashboard hero ([Dashboard.tsx:117](src/pages/Dashboard.tsx:117)) and again as the Investment equity-buildup chart ([Investment.tsx:220](src/pages/Investment.tsx:220)). **Gross yield** is computed in Dashboard, Overview, and conceptually in Investment. **"Invested" and "rent received"** appear on Dashboard metrics, Overview, and Investment.

Why it hurts: the investor can't form a single trusted answer to "how is my property doing?" — every screen gives a partial, differently-worded version. It also means three code paths that can silently disagree.

### T2 — Two-layer navigation with a redundant hub
Bottom nav has 6 tabs; **"הנכס"** then opens a hub with **6 more sub-tabs** (סקירה / נכס / משכנתא / שכירות / ביטוח / תשואה) — [PropertyHub.tsx:13](src/pages/property/PropertyHub.tsx:13). The first sub-tab, **סקירה (Overview)**, is itself just a grid of cards that link to the *other five sub-tabs* — [Overview.tsx](src/pages/property/Overview.tsx). So you have a tab bar whose first tab is a menu duplicating the tab bar. On a 375px screen, six Hebrew sub-tabs will crowd or scroll.

### T3 — Inconsistent terminology for the same concept
"נטו חודשי" (Dashboard, Investment) vs "מאזן" (Finances) vs "מצב נקי מצטבר" (Investment) — three names, three scopes (monthly projected / period actual / lifetime cumulative), no labeling that tells the user which is which. The app even names itself three ways: sidebar "דירה" ([index.css sidebar-title]), Login "ניהול דירה" ([Login.tsx:22](src/pages/Login.tsx:22)), hub header "הנכס".

### T4 — Wide data tables on a mobile-first app
- Finances transactions table = 6 columns ([Finances.tsx:409](src/pages/Finances.tsx:409))
- Recurring items table = **8 columns** ([RecurringItems.tsx:272](src/pages/RecurringItems.tsx:272))
- Mortgage amortization = 6 columns ([Mortgage.tsx:887](src/pages/Mortgage.tsx:887))

At 375px these either overflow (horizontal scroll, which hides columns and feels broken) or compress text to unreadable. Tables are a desktop pattern; this is a phone app.

### T5 — "תשואה" (Yield) tab barely shows yield
The tab is named *Yield*, but its content is dominated by **cost accounting**: total invested, interest paid, insurance paid, maintenance, a monthly cash-flow card, and a collapsible cost editor — [Investment.tsx](src/pages/Investment.tsx). The actual yield % lives on the **Overview** card, not here. The label sets the wrong expectation.

### T6 — Inconsistent "add/edit" interaction patterns
- Tasks: inline add row + modal edit ([Tasks.tsx:202](src/pages/Tasks.tsx:202))
- Finances / Recurring / Documents / Insurance: modal for both
- Mortgage: inline edit mode toggle ([Mortgage.tsx:342](src/pages/Mortgage.tsx:342))
- Investment costs: inline collapsible editor with a Save button

Five surfaces, four interaction models. The user re-learns "how do I add a thing" on every screen.

---

## 2. Information architecture — recommended restructure

**Goal:** flatten to what a single-property investor actually checks.

Proposed top-level nav (still 5 tabs, but each is a real destination, not a menu):

| Tab | Owns | Replaces |
|---|---|---|
| **ראשי** (Home) | Equity hero, *the one* monthly cash-flow card, yield, attention list, recent activity | Dashboard + Overview merged |
| **הנכס** (Property) | Details, mortgage, rental contract, insurance — as **collapsible sections on one scrollable page**, not 6 sub-tabs | PropertyHub sub-tabs |
| **כספים** (Money) | Transactions + recurring (keep the 2 sub-tabs; this split is justified) | Finances hub |
| **משימות** (Tasks) | as-is | — |
| **מסמכים** (Docs) | as-is | — |

**Kill the Overview sub-tab** — it's a redundant navigation layer. Its cards become the Home screen's content (which is where an investor looks first anyway).

**Fold "תשואה" into Home** — the yield %, invested total, and net position are summary facts that belong on the first screen. Keep the *cost editor* (the "כמה הושקע" table) as a section inside the Property page, since it's data entry, not a dashboard.

If 6 property sub-sections feel like too much for one scroll, use an accordion (one open at a time) rather than tabs — it keeps everything on one URL and avoids the crowded sub-tab bar.

---

## 3. Screen-by-screen

### 3.1 Login — [Login.tsx](src/pages/Login.tsx)
- Clean, single CTA. Good.
- Minor: app name here is "ניהול דירה" but elsewhere "דירה"/"הנכס". Pick one and use it in all three spots.

### 3.2 Onboarding — [Onboarding.tsx](src/pages/Onboarding.tsx)
- The grey-placeholder "computed default" pattern (defaults shown greyed until the user types) is genuinely excellent UX — keep it.
- 5 steps that expand to 6–7 screens is long, but it's one-time and the partial-save resilience is good.
- **Issue:** DEV "מלא דוגמה" fill buttons on every step — confirm these are stripped from production builds (they should be `import.meta.env.DEV`-gated). If not, that's a polish/credibility bug.
- **Opportunity:** end the flow by dropping the user on the new Home screen with a one-line "here's your property at a glance" so the payoff of all that data entry is immediate.

### 3.3 Dashboard / Home — [Dashboard.tsx](src/pages/Dashboard.tsx)
- Equity hero with the own/debt bar is the strongest single component in the app. Make it *the* anchor of the merged Home screen.
- **Confusion:** "שכ״ד חודשי" (monthly rent, section 2) sits a few pixels from "שכ״ד שהתקבל" (cumulative rent received, section 3). Same word, totally different number. Rename the cumulative one to something like "שכ״ד שנגבה (מצטבר)" and visually separate the "this month" block from the "lifetime" block.
- **Friction:** the bottom quick-action "+ תנועה" navigates to /finances but does **not** open the add-transaction form ([Dashboard.tsx:274](src/pages/Dashboard.tsx:274)). A "+" button should open the form. Pass router state to auto-open the modal (the Finances page already supports `location.state.prefill` — reuse that mechanism).
- Per-section skeleton loading is well done; keep it.

### 3.4 Property → Overview — [Overview.tsx](src/pages/property/Overview.tsx)
- Recommend **removing** as a standalone tab (see §2). The 6 cards are a good *summary* but a poor *navigation hub* layered on top of an existing tab bar.
- If kept short-term: the "הכנסות / הוצאות" split card ([Overview.tsx:92](src/pages/property/Overview.tsx:92)) crams two large currency values + a slash + a two-line caption — hard to parse. Split into two cards or simplify.

### 3.5 Property → Details — [Details.tsx](src/pages/property/Details.tsx)
- Clean field rows + modal edit. Fine.
- Address stored as "street, city" and block/parcel as a formatted string — acceptable for one property.

### 3.6 Property → Mortgage — [Mortgage.tsx](src/pages/Mortgage.tsx)
- This is the most powerful and most recently-polished screen. The 2×2 summary, single ערוך toggle, and inline-editable cards are good.
- **Density warning:** summary (4 cards) + tracks + 2 analytics charts + full amortization schedule is a *lot* on one mobile page. The amortization table (6 cols) is the weakest part on mobile — consider collapsing it behind a "הצג לוח סילוקין" disclosure (it's reference data, rarely needed at a glance).
- The grace-period inline editing and effective-rate split (prime + margin) are sophisticated and correct — leave the logic alone.

### 3.7 Property → Rental — [Rental.tsx](src/pages/property/Rental.tsx)
- Contract cards with status badges (active/expiring/expired by days-left) are good and consistent with Insurance.
- Utilities tenant/owner toggle is a nice touch.

### 3.8 Property → Insurance — [Insurance.tsx](src/pages/property/Insurance.tsx)
- Mirrors Rental's card+badge pattern well. Good consistency *within* the property hub.
- Type selector as a toggle-group ([Insurance.tsx:56](src/pages/property/Insurance.tsx:56)) — nice, more tappable than a `<select>`.

### 3.9 Property → Investment ("תשואה") — [Investment.tsx](src/pages/Investment.tsx)
- **Rename** and **resplit** (see T5/§2). The 6 negative/positive summary cards + monthly flow + equity chart + cost editor is doing the job of three screens.
- The collapsible "כמה הושקע" cost editor is good *data-entry* UX — move it into the Property page as an editable section.
- The equity-buildup sparkline is a great *insight* — move it to Home next to the equity hero (they're the same story).

### 3.10 Money → Transactions — [Finances.tsx](src/pages/Finances.tsx)
- The "actual overrides projected" virtual-row system is clever and the legend explains it ([Finances.tsx:404](src/pages/Finances.tsx:404)) — but it adds cognitive load. Consider a subtler visual treatment (e.g. dashed left-border + lighter text) instead of a "מחושב" badge per row.
- **Mobile:** the 6-column table will overflow. Convert to a stacked row/list layout on mobile (date + category on line 1, amount right-aligned, description muted below) — matching the clean `gtask-item` pattern already used in Tasks.
- Amount inputs format with `toLocaleString('en-US')` → English thousands separators inside a Hebrew UI ([Finances.tsx:327](src/pages/Finances.tsx:327)). Minor, but `he-IL` would be more consistent.
- The receipt button uses a hand-rolled inline SVG link icon ([Finances.tsx:445](src/pages/Finances.tsx:445)) while the rest of the app uses Phosphor icons — swap for a Phosphor `Paperclip`/`Receipt` for visual consistency.

### 3.11 Money → Recurring — [RecurringItems.tsx](src/pages/RecurringItems.tsx)
- **8-column table is the worst mobile-fit in the app.** Convert to cards/list: category + payee as title, amount + day-of-month as meta, badges for execution-type, edit/delete actions. The income/expense section split is good — keep it.

### 3.12 Tasks — [Tasks.tsx](src/pages/Tasks.tsx)
- The Google-Tasks-style inline add + checkbox list is the **best list UX in the app.** Use it as the template for converting the Finances and Recurring tables to mobile-friendly lists.
- The "complete a repair/rent task → offer to log the transaction" automation ([Tasks.tsx:102](src/pages/Tasks.tsx:102)) is excellent, investor-minded behavior. Keep and extend the pattern.

### 3.13 Documents — [Documents.tsx](src/pages/Documents.tsx)
- Card grid with type badges is clean. Fine as-is.
- Consider auto-linking documents to their context (a rental contract PDF shown on the Rental section, insurance policy on Insurance) so docs aren't a dead-end archive.

### 3.14 Settings — [Settings.tsx](src/pages/Settings.tsx)
- "פיתוח ובדיקה → איפוס כל הנתונים" (delete everything) is a **dev tool sitting in production settings** ([Settings.tsx:98](src/pages/Settings.tsx:98)). It has a confirm step, but it should be `import.meta.env.DEV`-gated or removed before real use — a mis-tap wipes the user's entire investment record.
- The Google Tasks sync explanation (token expires ~1h) is honest but exposes plumbing; fine for now.

---

## 4. Cross-cutting

### Visual system — [index.css](src/index.css)
- Token system is solid: teal accent, semantic success/danger/warning, spacing scale, shadow scale, radius scale, fast transitions. This is a real design system — good foundation.
- Display font (Frank Ruhl Libre) + body (Rubik) is a tasteful Hebrew pairing.
- Keep the tokens; the problems are structural/IA, not stylistic.

### Empty / loading / error states
- **Empty:** consistent `empty-state-cta` with icon + CTA across pages. Good.
- **Loading:** per-section skeletons (`SkeletonList/Stats/Card`) — among the better-executed parts of the app.
- **Error:** uniformly a bare `form-error` string with `role="alert"`. Functional but stark; a friendlier inline treatment with a retry affordance would build confidence, especially on data-fetch failures.

### Forms
- Standardize on **one** add/edit pattern. Recommendation: modal for "create new entity" (contract, policy, recurring item, transaction); inline for "quick add to a list" (tasks). Document the rule so future screens don't invent a fifth pattern.
- `confirm()`/`alert()` native dialogs are used for deletes in several places ([Finances.tsx:234](src/pages/Finances.tsx:234), [Tasks.tsx:92](src/pages/Tasks.tsx:92), [Insurance.tsx:147](src/pages/property/Insurance.tsx:147)) while Mortgage uses a custom inline confirm ([Mortgage.tsx:389](src/pages/Mortgage.tsx:389)). Native dialogs look out-of-app on mobile. Adopt the Mortgage inline-confirm pattern everywhere.

### RTL / language
- RTL handling looks consistent. Just fix the en-US number formatting noted above and pick one app name.

---

## 5. Prioritized recommendations

### P0 — High impact, do first
1. **Merge Dashboard + Overview + Investment-summary into one Home screen.** One equity hero, one monthly cash-flow card, one yield figure, attention list, recent activity, equity-buildup chart. Kill duplicate computations. (T1)
2. **Remove the Overview sub-tab; flatten the Property hub** from 6 sub-tabs to one scrollable page with collapsible sections (details / mortgage / rental / insurance / costs). (T2)
3. **Convert the Finances and Recurring tables to mobile card/list layouts** (reuse the Tasks `gtask-item` pattern). (T4)
4. **Gate or remove the "delete all data" and "מלא דוגמה" dev tools** from production. (§3.14, §3.2)

### P1 — Clarity & consistency
5. **Unify net/balance terminology** and label each by scope (this-month / period / lifetime). Pick one app name. (T3)
6. **Rename "תשואה"** and move yield to Home; keep only the cost editor in Property. (T5)
7. **Make "+ תנועה" actually open the add form.** (§3.3)
8. **Standardize add/edit + delete-confirm patterns** (inline confirm everywhere; documented modal-vs-inline rule). (§4)

### P2 — Polish
9. Collapse the mortgage amortization table behind a disclosure. (§3.6)
10. Replace hand-rolled SVGs (receipt link icon) with Phosphor icons; fix en-US number formatting to he-IL. (§3.10)
11. Friendlier error states with retry. (§4)
12. Auto-link documents to their property context. (§3.13)

---

## 6. What NOT to change (working well — don't regress these)
- The equity hero + own/debt bar.
- Per-section skeleton loading.
- The onboarding grey-placeholder computed-defaults pattern.
- Tasks inline-add list + the "task done → log transaction" automation.
- The mortgage track logic (prime/margin split, grace handling, amortization math).
- The design-token system in `index.css`.
- The Finances "actual overrides projected" virtual-entry concept (refine its *visual* treatment only, keep the logic).
