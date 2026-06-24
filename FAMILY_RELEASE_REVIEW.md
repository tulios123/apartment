# Family-Release Review — live log

**Mission:** full sweep of the app (UX · flow · design · correctness) to make it ready to share with family.
**Autonomy:** "תקן ושלח" — fix clear bugs + clear UX/design wins autonomously, commit+push, log everything; leave judgment-call redesigns for the owner.
**Priority order:** (1) new-user experience · (2) stability/correctness · (3) visual polish.
**Started:** 2026-06-24.

**Constraint:** dev auto-logs-in `dev@test.local` (has property + data). Populated screens reviewed live in preview; new-user / empty states reviewed by reading code paths (can't safely create a zero-data account against the linked remote DB).

---

## Severity legend
- 🔴 BLOCKER — broken / would embarrass on a fresh family install → fix now
- 🟠 CLEAR WIN — obvious UX/design improvement → fix now
- 🟡 JUDGMENT — bigger or opinionated change → log, leave for owner
- ✅ DONE — fixed + pushed (commit noted)

---

## Status summary (updated as the pass runs)

**Shipped this pass (6 fixes, all pushed):**
- F1 — splash no longer hangs ~5s on a cold-start/deep-link to a non-home tab (`22dbb63`)
- F2 — Insurance empty state: removed redundant top add button (`22dbb63`)
- F5 — Settings: real auth provider instead of hardcoded "Google" (`110af75`)
- F6 — Settings: gated the "גנרציה חודשית" debug section from family (`110af75`)
- F7 — Rental empty state: removed redundant top add button (`d885fda`)
- F11 — pinned `color-scheme: light` so native controls stay light in OS dark mode (`a2f2cd3`)

**Verified good, no fix needed:** destructive "reset all data" already gated to dev/admin · DevNotes overlay gated · PWA manifest + all icon assets present/correct · friendly error state (Warning + retry) · Tasks/Documents/Login/Home/Wealth/Property-admin all well-built · app CSS is dark-safe (stays light).

**Left for owner (judgment calls):** F3 naming תזרים↔כספים · F4 quiet empty months (actually fine) · F8 native confirm() dialogs · F9 hero-number sign/₪ bidi · F10 "כניסת מנהל" visible on login.

**Surfaces reviewed:** Home · Finances · Wealth (+editor) · Property-admin (×4 tabs) · Settings · Login (code) · transaction form · dark mode. Onboarding skipped (locked + can't preview in dev).

---

## Findings log

### F1 ✅ Splash hangs 5s on cold-start / deep-link to any non-home route — FIXED (22dbb63)
Only `HomeScreen` calls `markReady()`. App holds the splash-overlay until `appReady`, with a 5s safety ceiling. So a PWA cold-start or refresh while the last route was `/finances`, `/wealth`, or `/property` shows a blank-ish splash for the **full 5 seconds** before the screen appears. Returning family members who left the app on a non-home tab hit this every reopen. **Fix:** only hold the splash on the home route — initialise `appReady` from `window.location.pathname !== '/'` so non-home routes render their own (fast) skeletons immediately. (App.tsx)

### F2 ✅ Insurance empty state redundant top button — FIXED (22dbb63)
On the empty Insurance tab there are two identical add affordances: a top "+ פוליסה חדשה" button AND the empty-state "+ הוסף פוליסה" CTA, with an awkward gap between them. Inconsistent with Tasks (inline-add only) and Documents (empty-CTA only). **Fix:** hide the top button when there are no policies; let the empty state own the CTA. (Insurance.tsx)

### F3 🟡 Naming: nav "תזרים" vs page title "כספים" (+ desktop sidebar "ניהול דירה")
Nav tab label and the page H1 disagree (תזרים ≠ כספים). הון/ניהול match their tabs; only finances is off. Desktop sidebar also says "ניהול דירה" — a third app-name variant vs "Apartment" elsewhere (desktop-only, lower priority). Owner to pick the canonical name. Not auto-changed.

### F5 ✅ Settings: provider hardcoded "Google" — FIXED
Account section showed a literal "ספק: Google" for everyone. A magic-link family member signs in via email, not Google, so the label was wrong. Now derived from `user.app_metadata.provider` → "Google" / "אימייל". (Settings.tsx)

### F6 ✅ Settings: "גנרציה חודשית" plumbing exposed to family — FIXED
The "גנרציה חודשית" section (jargon + a manual "הרץ שוב חודש זה" debug button) was visible to all users. Generation runs automatically; the manual control is a debug affordance. Gated behind `showDevTools` (dev/test/admin) like the reset tool, so family settings are just חשבון + התראות. Reversible if the owner wants it back. (Settings.tsx)

### F-safe ✅ "Reset all data" tool already gated (no fix needed)
The destructive "איפוס כל הנתונים" section is gated to dev/test/admin — family members never see it. The old review's concern is already handled.

### F7 ✅ Rental empty state had the same duplicate add button — FIXED
"+ חוזה חדש" appeared in both the section header and the empty-state CTA when there were no contracts. Header button now hidden when empty (heading kept). (Rental.tsx)

### F8 🟡 Native confirm() dialogs scattered (delete contract, task follow-up)
`Rental.handleDeleteContract` uses `confirm('למחוק חוזה זה?')`; `HomeScreen.markTaskDone` uses `confirm(followup.msg)`. Insurance/Mortgage use a nicer inline confirm. Native dialogs look browser-chrome-y on an iOS PWA. Consistency polish — log only (changing delete UX carries small risk; owner can prioritise).

### F11 ✅ Dark-mode: native controls rendered dark — FIXED
The app is light-only (no `prefers-color-scheme` styles) but never declared a `color-scheme`, so an OS dark-mode family member would get the browser's **dark-tinted native controls** — date pickers, selects, scrollbars, autofill — clashing with the light UI. Pinned `color-scheme: light` in `:root` (index.css) + `<meta name="color-scheme" content="light">` (index.html). Verified: the transaction form's date input + selects now render light in emulated dark mode. (NB: the app's own cards are unaffected — they have no dark styles, the earlier "faded" capture was just the entry animation mid-frame.)

### F4 🟡 Weak text-only empty states on Finances & Wealth
`FinancesV2` empty month → bare "אין תנועות בחודש זה"; `WealthHub` !hasData → bare "עדיין לא הוגדרו נכס…". Both lack the ClayIllustration treatment used elsewhere. Rare for a post-onboarding user (they have projected rows / a property), so low priority — log only.

---

## Screen sweep checklist
- [ ] App entry / splash / auth gate (code-read)
- [ ] Login (code-read)
- [ ] Onboarding regression check (locked — verify nothing broke)
- [ ] Home (HomeScreen)
- [ ] Ledger / תנועות (FinancesV2 + FinancesHub)
- [ ] Wealth / הון (WealthHub: FinancingStructure, OwnershipScore, WealthAccelerator)
- [ ] Property Admin / ניהול נכס (PropertyAdminHub: Insurance, InvestmentCosts, Rental, PropertyForm, Tasks, Documents)
- [ ] Settings
- [ ] Cross-cutting: empty states, error states, RTL, number formatting, nav
