# Overnight QA + Hardening Run

> Autonomous run started while the owner sleeps. Goal: make the family-facing app
> bulletproof — find real bugs across the whole app, fix the high-confidence/low-risk
> ones (verified, committed per fix), and leave a clear list of anything risky/ambiguous
> for morning review. **No new features** (the monthly-close screen is explicitly skipped).
> Principle: don't ship a destabilizing change unattended — when a fix is behavioral or
> ambiguous, log it under "Needs your call" instead of guessing.

## Plan (phases)
1. **Bug hunt** — adversarial multi-agent review across 8 areas (onboarding, dashboard,
   finances, wealth/liabilities, property/rental/insurance, core hooks/lib, docs/settings,
   push/SW/edge). Every finding verified by a second agent. → confirmed list with risk tags.
2. **Fix** — apply the `autofix` (mechanical/low-risk) confirmed findings, commit each,
   tsc/build green. Flag `review` ones below.
3. **Old feedback triage** — go through the remaining feedback-table items, fix the still-valid clear ones.
4. **Push hardening** — finish any remaining E1/E2 gaps (pushsubscriptionchange SW handler).
5. **Live smoke** — walk the main flows as the dev account (AI-cost-free via the bypass), catch runtime issues, fix.
6. **Final verify** — tsc · tests · build · summary.

## Progress
- Phase 1 bug hunt: launched.

## Fixed (committed)
_(appended as I go)_

## Needs your call (flagged, not auto-applied)
_(appended as I go)_
