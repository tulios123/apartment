# 03 — UX Friction, Performance & Mobile Traps

> Visual-flow interruptions, perceived-performance issues, re-render waste, and
> mobile-specific traps (virtual keyboard, touch, absolute positioning).
> Audit date: 2026-06-26. Target device: installed iPhone PWA, Hebrew RTL.

---

## Mobile interaction traps

- **UX-01 · ExpenseSheet step-2 auto-focus pops the keyboard over the form.** `ExpenseSheet.tsx:97-101` auto-focuses the description input 380ms after sliding to step 2. On iOS the keyboard immediately covers the **category chips, payment chips, date chips, receipt button, and the save button** below the input. `BottomSheet` lifts the sheet by the keyboard inset (`visualViewport`, lines 61-69), but if `.bsheet-body` doesn't scroll independently, lower controls remain occluded — a classic keyboard trap where the user can't reach "שמירת הוצאה" without dismissing the keyboard first. **Verify** `.bsheet-body` is `overflow:auto` with the kbInset padding; if not, the lower half is unreachable. Consider *not* auto-focusing — let the user tap chips first, focus the text field only on demand.

- **UX-02 · Swipe-down / scrim-tap / Esc discard typed data without confirmation.** `BottomSheet.tsx`: swipe-down past threshold docks the sheet when `minimizable` (good, preserves data), **but** a **scrim tap** (`line 101 onClick={onClose}`) and **Esc** (line 52) call `onClose()` outright — discarding a half-typed expense/task with no "discard?" confirm. The careful `minimizable` data-preservation is bypassed by the two most common dismiss gestures. *Fix:* when the form holds data, route scrim-tap/Esc through the same dock-or-confirm path as swipe-down.

- **UX-03 · Native `confirm()` for the money follow-up.** `HomeScreen.tsx:215` and `TasksV2.tsx:132` use the browser's blocking `confirm()` after completing a task. On the installed PWA this is an unstyled, jarring system dialog that **blocks the JS thread**, ignores the app's RTL/theme, and (per C5) can **stack multiple dialogs** on rapid completions. *Fix:* replace with an in-app, dismissible bottom-sheet/toast-with-action ("רוצה לרשום את ההוצאה?" · "כן" / "דלג").

- **UX-04 · Native `alert()` in Settings.** `Settings.tsx` (lines 95, 107, 117, 124, 157, 243) uses `alert()` for push errors, cache resets, etc. Same jarring system-dialog problem. *Fix:* inline status text / toasts.

- **UX-05 · No focus trap or focus restore in BottomSheet/Modal.** `BottomSheet` and `Modal` set `role="dialog" aria-modal="true"` but don't trap Tab focus inside, nor restore focus to the trigger on close. Keyboard/VoiceOver users can tab "behind" the sheet. Accessibility gap (also a subtle desktop annoyance).

- **UX-06 · Tap targets / safe-area.** Spot-check that the numpad keys, chips, and the bottom-nav clear the iOS home-indicator safe area and meet the 44×44pt minimum (the audit didn't measure CSS pixel-by-pixel — flagging for a device pass). The bottom tab bar + `FeedbackButton` FAB + on some screens a CTA all live at the bottom; verify they don't overlap on small devices.

## Offline / degradation experience

- **UX-07 · No offline support, and no offline messaging.** `public/sw.js` intentionally has **no fetch handler** (caches nothing). `_headers` makes the shell `no-cache` (revalidate). Result: offline cold start may load a stale shell from HTTP cache but **every data fetch fails** → the user sees skeletons that never resolve or scattered error strings, with **no "אתה במצב לא מקוון" banner**. The app is effectively online-only with no graceful degradation. *Fix (incremental):* a connectivity banner (`navigator.onLine` + `online`/`offline` events); longer term, a minimal offline read cache.

- **UX-08 · Write failures recover inconsistently.** Good: ExpenseSheet keeps the form populated and shows "לא הצלחנו לשמור — נסו שוב" on error. Inconsistent: quick-add restores text + flash (good); task-complete bounces back with a transient flash but already fired the follow-up (C5); receipt failure is silent (C7). Standardize a single "save failed, retry" affordance across all writes.

## Performance / re-renders / perceived speed

- **UX-09 · Splash can hang up to 5s.** `App.tsx:42-46` holds a blank splash with a **5-second safety ceiling**; `HomeScreen` only calls `markReady()` once **all seven** data hooks finish (`HomeScreen:168`). One slow/stuck query keeps the user on a blank splash for up to 5s on cold start. The SWR cache (`queryCache.ts`) mitigates warm revisits well, but the *first* cold start is gated on the slowest of 7 round-trips. Consider revealing the shell with skeletons sooner (progressive), rather than an all-or-nothing splash.

- **UX-10 · HomeScreen mounts seven data hooks.** `useDashboardStats`, `useMortgageData`, `usePropertyData`, `useLoansData`, `useInsurance`, `useTasks`, `useTransactions` — seven independent fetch lifecycles + the SWR seeding. The `actions` `useMemo` (line 108) depends on many values; fine, but every flash/busy state toggle re-renders the whole screen including the (memoized) action list. Not a bottleneck today thanks to the cache, but the screen is heavy — keep an eye on it as data grows.

- **UX-11 · `BottomSheet` keyboard-inset recompute churn.** `visualViewport` `resize`+`scroll` listeners call `setKbInset` on every event while the sheet is open (lines 61-69) → frequent re-renders during keyboard animation/scroll. Smooth in practice but worth throttling if jank appears on older devices.

- **UX-12 · Whole-table fetches.** `useDashboardStats` selects **all** transactions (no limit) to compute all-time totals + `slice(0,5)`. `useTransactions` selects `*` for the month. Fine at family scale; if a power user accrues thousands of rows over years, the dashboard fetch grows unbounded. Consider server-side aggregates for the all-time totals.

## Visual flow / information correctness

- **UX-13 · "N פעולות" header counts unbounded renewals; tasks are capped at 2.** `HomeScreen`: the action list is rent (≤1) + **top-2 tasks** + **all** in-window renewals. The header "יש N פעולות שמחכות לך" (line 271) counts the *rendered* list, so with several renewing contracts it can read higher than the 2-task cap implies. `extraTaskCount` correctly counts only hidden tasks. Mostly fine for a single property; note that renewals aren't bounded like tasks are.

- **UX-14 · Stale "נותרו X ימים" in the persistent renewal task.** `useMonthlyGeneration` writes the renewal task title with a **baked-in** day count and `due_date = today`; the task is created once and never updated, so the title's "X days" goes stale immediately and the task shows as due "today" indefinitely. The home renewal *card* (from `useDashboardStats`) recomputes live, but the **Tasks list** shows the frozen number. *Fix:* don't bake the day count into the title (compute it at render), or refresh it.

- **UX-15 · `formatCurrency` hides agorot — sublists may not visibly sum.** All amounts render with `maximumFractionDigits:0`. If any amount carries agorot, an expandable sublist of rounded rows can visibly **not add up** to the rounded total. Low likelihood (whole-shekel data) but a credibility paper-cut if it occurs. Decide: round at entry, or show agorot.

- **UX-16 · Receipt attach has no progress / confirmation of success.** Beyond the silent-failure bug (C7), even on success there's no "מעלה…" state — the save button shows "נשמר" while the upload may still be in flight (it's awaited inside `save`, so it does complete before "done", but a large file makes "saving" feel hung with no progress).

## Onboarding-specific friction

- **UX-17 · No "resume" + re-pick files after any interruption.** Ties to C2: beyond data loss, even when the extraction cache survives, the user must **re-select every file** to re-derive its hash; there's no indication that "this file was already read". A resume affordance + remembering file *names* (even if the bytes must be re-picked) would soften it.

- **UX-18 · Per-step uploaded-files panel is good; verify the toggle affordance reads as expandable.** Recent change made each step's upload button toggle a files panel (caret + "הקישו לצפייה"). Verify on-device that the caret + count clearly signals "tap to expand" vs "tap to upload", so users don't think tapping re-uploads.
