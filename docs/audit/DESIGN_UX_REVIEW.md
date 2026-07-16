# DESIGN & UX REVIEW — "ניהול דירה" (Mobile · Light Theme)

Screenshot review · 16.7.2026 · 24 screenshots (iPhone, PWA) · Yardstick: `/docs/handoff/design-language.md` + `screens.md`; comparison standard: first-tier banking apps (ANZ Plus).
Findings are tagged inline: **[bug]** / **[design]** (opinion within the existing language) / **[product question]** (needs a discussion, not a task). Items marked *(verify live)* cannot be confirmed from a static shot.

---

## 0. Coverage inventory

| Screen-map area | Covered | Notes |
|---|---|---|
| Home — ראשי | ✔ | "All clear" state only; no pending-approval state |
| Finances — תזרים | ✔ | Month, Year, Range + new-expense flow (2 steps) |
| Wealth — הון | ✔ | Full scroll: hero, accelerator, financing structure, recovery card, stats |
| Financing & costs editor | ✔ | Full scroll (5 shots): summary, 6 tracks, docs, loans, equity & costs |
| Property hub | ✔ | Cover + all 4 tabs (חוזה / ביטוח / משימות / מסמכים) |
| Forms | ✔ | Contract edit, Policy edit, Property edit (top), New document |
| Sheets | ✔ | New expense (keypad + details), New task |
| Account menu | ✔ | Popover only — Settings screen itself not captured |
| Login / Onboarding | ✖ | Deferred by owner — in gaps list |
| Dark theme / Splash / states | ✖ | See gaps list (§6) |

---

## 1. Overall verdict

The bones are genuinely banking-grade: one-number heroes, tabular numerals that actually align money columns, a coherent card system, and RTL that is clearly deliberate rather than translated. Financial integrity across screens is flawless — 4,300−3,838=+462 agrees between Home and Finances; 3,113+651+74=3,838; 64,025 = 1,090,000−875,975−150,000; the six editor tracks sum exactly to the 4,317 ₪ grace warning — every screen agrees with every other, which is the hardest thing to get right and it is right. On the works→top-of-the-line scale the app sits in the upper third. The single thing that most cheapens it right now: **the control vocabulary is not unified** — dashed borders carry four meanings, green tags five, three single-select styles, two delete icons, and CTA grammar wanders (שמור / שמירה / שמירת הוצאה / המשך). Each screen is polished in isolation; the system's voice wavers between screens, and that wavering is precisely what a user feels as "almost, but not a bank."

---

## 2. Per-screen review

### 2.1 Home — ראשי
**Verdict:** right idea (calm command center), wrong vertical budget — the money is below the fold.

1. **[design]** Duplicate "all clear": the subtitle "הכול רגוע היום — אין מה לעשות עכשיו." and the card "הכול מטופל…" say the same thing in adjacent components. Keep the card, cut the subtitle — reclaim ~90px and lift "תזרים החודש" toward the fold.
2. **[design]** Semantic color splits inside one card: received rent "4,300 ₪" is green, but "‎-3,838 ₪" and "+462 ₪" are navy — and Finances paints the very same +462 green. Pick one law — color-by-sign (the Finances convention) — and apply it here too.
3. **[design]** The lightbulb FAB overlaps the green progress bar and the coins icon. A floating control must never sit on financial content. (Cross-cutting §3.1 — this pattern repeats on nearly every screen.)
4. **[design]** "הוצאה" / "משימה" buttons use dashed borders — but dashed is already the app's language for forecast rows and missing documents. Secondary actions should be solid-outline. (Cross-cutting §3.2.)
5. **[microcopy]** The tag "אוטומטי · הוצאה" mixes execution mode with direction; the minus sign already carries direction. "אוטומטי" alone.

**Keep:** the quick-capture placeholder "למשל: שילמתי 350 ₪ על תיקון ברז…" — the best onboarding-free teaching in the app.

### 2.2 Finances — Month
**Verdict:** clear ledger with the right number on top; the add-button and the legend both shout louder than they should.

1. **[design]** "הוספת תנועה" is the largest element on the screen — physically bigger than the balance number. On a reading screen that inverts hierarchy. Standard button height, or anchor it next to the section title like "+ חוזה חדש".
2. **[microcopy]** The legend "מקווקו = תחזית מהחוזה/משכנתא" explains a visual code in words while every forecast row already carries a "תחזית" tag — double encoding plus a legend that admits the encoding isn't self-evident. Cut the legend, keep the tag.
3. **[bug]** *(verify live)* The month pager places ‹ left and › right of "יולי 2026" — the LTR convention. In RTL, forward-in-time should be the **left** chevron. Verify tap mapping and that the slide animation direction matches.
4. **[design]** The forecast row wears three markers at once — dashed frame, "תחזית" tag, and a distinct orange icon. Two suffice (dashed + tag).

**Keep:** "קרן 0 ₪ · ריבית 3,113 ₪" on the mortgage forecast row — surfacing the grace-period truth inside the ledger is exactly the transparency this product promises.

### 2.3 Finances — Year
**Verdict:** correct RTL chart — but the future is painted as confidently as the past.

1. **[design]** Aug–Dec 2026 forecast bars render in the same solid red/green as actuals, while the list below distinguishes forecasts with dashed borders and tags. Encode forecasts in the chart too (reduced opacity or hatching) — one concept, one look.
2. **[design]** The current-month highlight (יול) is a tint so light it barely registers at arm's length. Strengthen it.

**Keep:** the month axis runs right-to-left (ינו rightmost) — correct RTL charting, rarer than it should be.

### 2.4 Finances — Range
**Verdict:** does its job; the footer tries to be both a summary and a tutorial.

1. **[microcopy]** "סך התקופה: ‎+1,013 ₪ על פני 5 חודשים לחצו על עמודה לפירוט" — two sentences fused, and the blue "לחצו על עמודה לפירוט" looks like a link but is an instruction. Split them, or drop the hint and let the chart's tap affordance do the work.
2. **[bug]** *(verify live)* Bidi date-range ordering is inconsistent: the range header here reads start-first in reading order (10.3 → 16.7 from the right), while the contract card's "תקופה" appears to read end-first. One of the two is bidi-swapped. Enforce with LRM/RLM marks; house law: **start date first in reading order (right)**.

**Keep:** "מאזן התקופה" stays inside the מאזן החודש / מאזן השנה term family — one concept, one word.

### 2.5 Wealth — הון (hero + accelerator)
**Verdict:** the strongest screen in the app — one navy hero, one number, a story that reads top-down. The accelerator card needs labeling discipline.

1. **[design]** "ערוך מימון ועלויות" floats as a lone outline pill above the page, detached from everything. Every other page anchors its action to a section ("+ חוזה חדש", "+ פוליסה חדשה"). Anchor it to the "מבנה המימון" section header.
2. **[design]** The "+381 ₪ לבעלות החודש" pill on the hero has full button anatomy (border, pill, arrow icon) but is static — false affordance. Either make it scroll to מאיץ ההון or restyle as a plain badge.
3. **[design]** מאיץ ההון: the thin progress bar under "מכל תשלום חודשי של 3,764 ₪" is unlabeled — nobody can say what it measures. Label it ("חלק הקרן מהתשלום") or delete it.
4. **[microcopy]** "עמלה לבנק" as the caption for interest (3,383 ₪, 90%) — interest is not a fee, and this app's brand is precision. "ריבית לבנק".
5. **[design]** "בבעלותך 6% מהנכס" — the actual value is 5.87%; standard rounding flatters. Per the house rule of conservative presentation, show one decimal (5.9%) or floor.

**Keep:** the ownership bar reads right-to-left as *yours → family → bank* — the RTL order itself tells the story correctly.

### 2.6 Wealth — financing structure section
**Verdict:** the grace warning is the best single line in the app; the balloon cards say everything twice, three times.

1. **[design]** Each balloon card states the balloon fact twice ("נפרעת במכירה" in the meta line **and** under the amount) × 3 near-identical cards = six repetitions on one screen. One line per card — or better, one "מימון משפחה · 150,000 ₪" group card with three rows (אמא / אבא / סבתא).
2. **[design]** "נפרעו 0%" appears twice on the mortgage card (meta line + progress caption). Once.
3. **[design]** The same balloon loans render as grey dashed cards here and as white orange-edged cards inside the editor — same entity, two costumes, ten seconds apart. Pick one card treatment.

**Keep:** "גרייס עד 3.2028 · תשלום מלא 4,317 ₪" in warning orange — the single most important risk in this portfolio, correctly colored, correctly placed.

### 2.7 Wealth — "הכנסות מול הוצאות" card + stats strip
**Verdict:** the most honest card in the app, wearing the wrong title.

1. **[product question]** The card actually shows **capital recovery** — rent received vs. capital invested vs. interest and maintenance paid, resolving to "הושקע נטו (טרם הוחזר)". "הכנסות מול הוצאות" undersells it and collides with the ledger's mental model. Candidate: "כמה מההשקעה חזר".
2. **[design]** The lightbulb FAB overlaps the "4.7%" gross-yield stat — the worst instance of the FAB-over-numbers pattern (§3.1).

**Keep:** tabular-nums earning its keep — the four amounts align to the digit. This is what banking apps get wrong and you got right.

### 2.8 Financing & costs editor (modal)
**Verdict:** complete and honest, but it's a five-screen scroll wearing a modal's clothes — and it hosts most of the app's inconsistencies.

1. **[design]** *(verify live)* The six track cards show **post-grace** payments (53+885+559+1,102+750+968 = 4,317 ₪) while the navy summary above says "תשלום חודשי 3,764 ₪" (today's grace payment + loan). Nothing on screen reconciles the two — a family member who adds the cards will hit a contradiction. Add a grace note per affected track (e.g., "בגרייס · תשלום מלא מ-3.2028") or show current-vs-full on each card.
2. **[design]** Track-type tags borrow status colors: success-green for "קבועה לא צמודה", warning-tan for "משתנה", blue for "פריים". Green/orange are the app's state semantics — using them for categories injects judgment (fixed=good, variable=caution) and dilutes real warnings like the grace banner. Use the decorative palette (purple/teal/coral) for types.
3. **[design]** Four AI-scan entry points, three styles: solid light-blue "סריקת מסמך משכנתא (AI)" / "סריקת מסמך הלוואה (AI)" / "סריקת חוזה שכירות (AI)", and the property form's dashed "📄 העלו חוזה רכישה — שמירה + מילוי אוטומטי". One component, one wording — and the emoji goes (the icon system is Phosphor).
4. **[design]** Mortgage document rows show raw filenames ("IMG_9999.png") as titles. These are typed documents — title by type + date, filename as caption.
5. **[design]** "שמור" as a lone bottom-left pill here, a שמור+ביטול pair in the policy form, full-width "שמירה" in sheets — three form-footer patterns. Pick one per container: full-width primary on sheets, sticky footer pair on full-screen forms.

**Keep:** live totals at the bottom ("סה"כ הושקע 334,735 ₪", "הון עצמי נטו… 184,735 ₪") update the story as you type — the right feedback loop for a financial editor.

### 2.9 Property hub — cover + Contract tab
**Verdict:** the cover card is a good "property passport"; delete affordances are the tab's weak point.

1. **[design]** The X icon deletes contracts and policies, while the editor uses a trash icon for loans. X means "close" everywhere else in the OS — X-as-delete is a data-loss trap for family users. Trash everywhere; X only dismisses. *(Confirm a delete-confirmation dialog exists — not visible in shots.)*
2. **[microcopy]** Tag "236 ימים" — days of what? "נותרו 236 ימים".
3. **[product question]** The cover headline is "הנכס שלי, אשקלון" because the street field literally contains "הנכס שלי" (see 2.19). The model conflates nickname and address — before family rollout, every property will be called "הנכס שלי".
4. **[design]** The green cover tag fuses tenant + status ("חומי–ניהול נכסים ויזמות בע"מ · חוזה פעיל") into one long pill that will wrap with a longer tenant name. Split: tenant as text, status as tag.

**Keep:** signature/delivery dates as quiet metadata at the card's foot — present, not shouting.

### 2.10 Property hub — Insurance tab
**Verdict:** clean and rhythmical; the tab's one number whispers.

1. **[design]** "סה"כ: 74 ₪ / חודש" is the tab's headline stat rendered as small grey text opposite the add-button. Promote it — same treatment as the documents tab's "3/6" counter.
2. **[design]** X-as-delete again (see 2.9-1).

**Keep:** the policy card format — "ביטוח משכנתא · ישיר", monthly premium, period — three facts, no fat.

### 2.11 Property hub — Tasks tab
**Verdict:** calm empty state — but it's the third different phrase for "all clear", and done-tasks are struck through into illegibility.

1. **[microcopy]** "הכול תחת שליטה" here, "הכול מטופל" on Home, "הכול רגוע היום" in the greeting. One house phrase for "all clear", reused.
2. **[design]** Maintenance-log entries get strikethrough + green check + "נסגר [date]" — triple done-encoding, and strikethrough makes history harder to scan ("when did I last check the boiler?"). Drop the strikethrough.
3. **[design]** Inline-add uses a **+** circle; Home's quick capture uses an **arrow** circle for the same submit-inline-text gesture. One icon.
4. **[design]** The empty-state card spends ~40% of the viewport on one sentence; half the padding buys the maintenance log a place above the fold.

**Keep:** יומן תחזוקה as a separate, quieter section below open tasks — correct hierarchy.

### 2.12 Property hub — Documents tab
**Verdict:** the "3/6" checklist metaphor is the best family-facing idea in the app; the card states need one law.

1. **[design]** Three card states with unclear grammar: dashed = missing, white+check = exists, blue-border+check = exists-with-count ("משכנתא · 4 מסמכים"). The blue border reads "selected", not "multiple". Law: dashed=missing, white+check=exists, count as a plain badge.
2. **[microcopy]** "חסר — העלה" is singular imperative in an app that speaks plural ("בחרו קובץ", "לחצו על עמודה", "הקלידו משימה"). "העלו". (Part of the voice pass, §3.4.)
3. **[design]** אוספים pills mix affordances: "קבלה 5" opens a list, "חשבונית +" adds. Same pill, two verbs — differentiate count-chip from add-chip.

**Keep:** "מסמכי הנכס 3/6" — progress framing turns paperwork into a completable game.

### 2.13 Contract edit form
**Verdict:** scan-first layout is right; this form hosts single-select style #2.

1. **[design]** "צ'ק / העברה בנקאית" uses a white-thumb-on-grey segmented; Finances uses a blue-fill segmented; the expense sheet uses outline pills for the same single-choice job. Three styles — one component app-wide (recommend the blue-fill; it is the most legible).
2. **[design]** *(verify live)* The empty phone field appears with different corner geometry/height than its sibling inputs — confirm it shares the input component.

**Keep:** "סריקת חוזה שכירות (AI)" at the very top — scan-then-correct is the right order of operations.

### 2.14 Policy edit form
**Verdict:** fine bones; the only entity form without an AI entry, and the optional-marking convention breaks here.

1. **[product question]** Contract, mortgage, loan, and property all offer AI scan; insurance doesn't. If the extractor supports policies — add the button; if not, this is a roadmap asymmetry worth noting, not a styling one.
2. **[microcopy]** Optional is marked via placeholder "אופציונלי" here, via label suffix "(אופציונלי)" in the document sheet. Label suffix everywhere — placeholders die on focus.
3. **[design]** Footer שמור+ביטול pill pair — the third footer pattern (see 2.8-5).

**Keep:** פרמיה with a חודשי/שנתי toggle, stored normalized (the card shows monthly) — good data hygiene.

### 2.15 New expense — step 1 (keypad)
**Verdict:** the two-step flow (amount → details) is the calmest capture pattern there is; the keypad itself is mirrored — and only two-thirds mirrored.

1. **[bug]** The digit rows are RTL-mirrored (top row reads 3-2-1, so **1 sits top-right**) while the bottom row keeps LTR positions (⌫ bottom-right). Numeric keypads are universal artifacts — Hebrew iOS keeps 1 top-left — and the half-mirroring makes it internally inconsistent too. Restore the standard grid; muscle memory beats mirroring.

**Keep:** one decision per screen — amount first, everything else later.

### 2.16 New expense — step 2 (details)
**Verdict:** the pill taxonomy works; the date is asked twice and the back arrow points the wrong way.

1. **[bug]** *(verify live)* The amount chip's arrow ("‏← 250₪") points left; the house RTL rule (the onboarding chevron) is back = **right**. If tapping it returns to the keypad, flip the arrow.
2. **[design]** The date is asked twice: quick pills ("אתמול / היום") **and** a calendar button also labeled "היום". Merge into one row: [אתמול | היום | תאריך אחר…].
3. **[product question]** Only three category pills are visible (תיקונים / ריבית / אחר) with no overflow affordance — is the taxonomy complete? And manual "ריבית" invites double-counting against the automatic interest forecast; consider a guard or removal.
4. **[microcopy]** CTA "שמירת הוצאה" vs. "הוספת תנועה" vs. "שמור" vs. "המשך" — the CTA grammar zoo (§3.5).

**Keep:** אופן תשלום pills mirror how Israelis actually pay, ביט first — localized, not translated.

### 2.17 New task sheet
**Verdict:** minimal and correct.

1. **[microcopy]** "הוסף תאריך ושעה" — singular imperative again (voice pass, §3.4).

**Keep:** the source button ("משימה") highlights behind the opened sheet — visible cause-and-effect.

### 2.18 New document sheet
**Verdict:** this sheet is the convention-setter — copy it everywhere.

1. **[design]** Default סוג = "אחר" buries the taxonomy. When opened from a typed context, prefill from context; otherwise leave unselected.

**Keep:** "שם (אופציונלי)" + placeholder "ברירת מחדל: שם הקובץ" — the correct optional pattern, and honest about defaults.

### 2.19 Property edit form
**Verdict:** the auto-fill promise is the trust move; placeholders need discipline.

1. **[design]** מ"ר placeholder is a grey "0" — zero as placeholder reads as a value. Empty field, or an example ("למשל: 85").
2. **[design]** The scan CTA carries an emoji (📄) — the only emoji in a Phosphor-icon app. Replace with the system icon (folds into the AI-button unification, 2.8-3).
3. **[product question]** רחוב holds "הנכס שלי" — the nickname lives in the address field (see 2.9-3).

**Keep:** the explainer under the scan button says exactly what will be extracted and that "אפשר לתקן לפני השמירה" — transparency as microcopy.

### 2.20 Account menu
**Verdict:** clean, correctly RTL-aligned popover.

1. **[product question]** "ניהול משוב" in the menu and the lightbulb FAB both point at feedback. For family users: is the menu item admin-only? If yes, hide by role; if both ship, they compete.

**Keep:** destructive "יציאה" isolated below a divider, in danger red — textbook.

---

## 3. Cross-cutting patterns (fix once, win everywhere)

1. **The lightbulb FAB occludes content on nearly every scrolling screen** — including the gross-yield stat (2.7) and editor footnotes. Dock it into the header (as modals already do) or retire it in favor of the menu's feedback entry.
2. **Dashed border means four things**: forecast rows, missing documents, add-buttons, and secondary actions — plus the balloon "passive" cards. Reserve dashed for exactly two: forecast (with tag) and empty-slot/add. Secondary actions become solid-outline.
3. **The green tag carries five meanings**: "התקבל", "חוזה פעיל", "236 ימים", "קיים", "קבועה לא צמודה". Keep green tags for state; move category tags (mortgage track types) to the decorative palette.
4. **Hebrew voice**: plural imperative dominates (בחרו / לחצו / הקלידו / העלו) but "העלה" and "הוסף" slip through; "all clear" has three phrasings; and the app bar says "ניהול דירה" while everything inside says "נכס". One voice pass over every string — one term per concept, plural imperative throughout.
5. **CTA grammar**: שמור / שמירה / שמירת הוצאה / הוספת תנועה / המשך coexist. One grammar (verbal noun) + container-consistent footers: full-width on sheets, sticky pair on full-screen forms.
6. **Single-select controls come in three skins**: blue-fill segmented, white-thumb segmented, outline pills. One component.
7. **Delete iconography**: X vs. trash (2.9-1). Trash deletes; X closes.
8. **Header budget**: navy status strip + app-name bar ("ניהול דירה" + avatar) + page title = three stacked headers before content, on every screen. Merge the page title into the top bar — the app doesn't need to introduce itself on every screen. The biggest single vertical-space win available.
9. **Forecast encoding diverges** between list (dashed + tag) and charts (solid bars). One encoding.
10. **Bidi discipline for LTR islands**: date ranges order inconsistently across screens (2.4-2). Directional marks + a written law: start date first in reading order.

---

## 4. The golden list (polish-per-effort, ranked)

1. Dock or retire the lightbulb FAB — every screen stops occluding numbers. **[design]**
2. One-hour Hebrew voice pass: plural imperatives, one "all clear" phrase, one CTA grammar. **[microcopy]**
3. Trash = delete everywhere; X = close only (+ confirm dialog verified). **[design]**
4. Restore standard keypad digit order (1-2-3, LTR grid). **[bug]**
5. Unify single-select to one segmented component (blue-fill). **[design]**
6. Merge the four AI-scan entries into one component; drop the emoji. **[design]**
7. Dim/hatch forecast bars in the year chart to match the list's forecast language. **[design]**
8. Home: delete the duplicate "all clear" subtitle; the cashflow card rises toward the fold. **[design]**
9. De-duplicate the balloon-loan cards (one line each, or one family-financing group card). **[design]**
10. Bidi audit: date-range ordering + month-pager chevron direction. **[bug]**

---

## 5. Product questions (collected — discussion before execution)

1. **Nickname vs. address**: add a כינוי נכס field before family rollout? The cover currently reads "הנכס שלי, אשקלון" because the nickname lives in רחוב.
2. **Insurance AI scan** — in or out of the extractor's scope?
3. **Expense category taxonomy**: is the 3-pill set (תיקונים / ריבית / אחר) complete? Should manual "ריבית" be guarded against double-counting with the automatic forecast?
4. **Rename "הכנסות מול הוצאות"** to reflect capital recovery ("כמה מההשקעה חזר")?
5. **"ניהול משוב" vs. the lightbulb** — which one do family users see, and what does each do?
6. **Ownership % rounding**: 5.87% displays as 6% — adopt one-decimal/floor per the conservative-presentation principle?

---

## 6. Gaps — to complete coverage

- Login, Onboarding (deferred by owner), Settings screen, Splash.
- **Dark theme — zero coverage**; the token swap warrants its own pass.
- States: action center with a pending rent approval; transaction edit drawer; category breakdown expanded; loading/skeletons; error banner; offline banner; an empty Finances month.
- Home on a busy morning (open tasks + renewal alert) — only the calm state was captured.
- The year-view screenshot is partially covered by a WhatsApp notification — reshoot the period-switcher area.
- Screen recordings for the motion questions below.

---

## 7. Motion questions for a live pass (static shots cannot judge)

1. Month pager: does the **left** chevron advance time (RTL-forward), and does the slide animation direction match?
2. Property tabs: transition type, and does the cover's scroll position persist across tabs?
3. Financing editor: open/close animation; save feedback (progress → success); scroll performance across its full length.
4. Expense flow: keypad→details transition continuity; does tapping the amount chip return to the keypad?
5. Bottom sheets vs. the iOS keyboard: does the sheet resize smoothly or jump when the task input focuses?
6. Quick capture: what does the send arrow show while the AI parse runs?
7. Category accordion: expand animation and chart draw-in.
8. Wealth scroll (nested cards + bars): smooth or jank?
9. Theme switch: instant token swap or flash? (The white flash on load is already a known family-test issue.)
10. Push-permission flow from Settings: what does the in-app state show while iOS asks?
