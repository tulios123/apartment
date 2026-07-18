# UX_RUN_STATE.md — UX-vs-FOUNDATIONS deep run, 18-19.07.2026 (owner in-flight #2)

**Mission:** full scored evaluation of the app against docs/audit/UX_FOUNDATIONS.md (Lenses A-E, 33 items + primer chapters 1-9), per the document's own method: independent evaluators → evidence per finding → severity 0-4 → consolidate → fix greens.
**Branch:** staging. Connected run (same Node-relay setup as the 18.07 audit).

## Phases
| phase | what | status |
|---|---|---|
| 1 | Inventory + evidence pack | **DONE** — 16 screens + 43 flow captures (tx add/edit/delete/error, quick-capture, numpad, approve-rent, task CRUD+follow-up, contract/policy/document/property forms, liabilities editor+track/loan forms, settings theme, onboarding 9 steps) + form/CTA metadata per surface + feedback-timing & error probes + 653-line Hebrew strings inventory. All test rows tagged and cleaned; baseline verified. |
| 2 | Independent lens evaluations (workflow: 7 evaluators — A,B,C,D,E + motion/ergonomics + finance/RTL) | running |
| 3 | Consolidate + dedup vs known ledgers + severity-score | pending |
| 4 | Green fix wave w/ live verification | pending |
| 5 | UX_VS_FOUNDATIONS.md report + landing report | pending |

## Early probe results (phase 1)
- D24 ✔ values preserved on save-fail · **D25 ✘ raw "TypeError: Failed to fetch" shown to the user** (known ROADMAP item "עברית מלאה", now with evidence)
- D22: edit-tx flash 120ms ✔ · theme switch 58ms ✔ · approve-rent flash 1880ms (network-bound; no interim state)
- D26: tx row delete = swipe-gesture only (no visible button; aria shows only עריכה) — for evaluators
- D27: save flash "התנועה עודכנה" / "יופי! שכר הדירה נרשם ✓" — captured
- Numpad sheet has icon-only buttons with empty accessible names (⌫ etc.) — for evaluators

Evidence pack: scratchpad/ux-evidence/ (session-local; findings carry the evidence into the report).
