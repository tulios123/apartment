# UX_FOUNDATIONS.md

*A UX primer and reusable evaluation instrument for the team behind ניהול דירה. Study material first; yardstick second. The instrument is deliberately app-agnostic so its findings carry independent authority when run against the app.*

Compiled from primary sources (Nielsen Norman Group, Laws of UX, Apple Human Interface Guidelines, Material Design, GOV.UK Design System, Shopify Polaris, WebAIM/W3C, rtlstyling.com). Retrieval date: 16 July 2026.

---

## PART 1 — THE PRIMER

### Chapter 1 — The Usability Canon

#### 1a. Nielsen's 10 Usability Heuristics
Source (all ten): https://www.nngroup.com/articles/ten-usability-heuristics/

**1. Visibility of System Status**
Essence: The interface should always tell the user what is happening, through feedback delivered quickly. When people can see the current state, they learn the result of what they just did and can decide what to do next. Predictable feedback builds trust.
Example: A "You Are Here" marker on a mall map tells you where you stand before you decide where to go.

**2. Match Between the System and the Real World**
Essence: Speak the user's language — familiar words, phrases and concepts, not internal jargon. Follow real-world conventions and present things in a natural order. Controls that map to outcomes the way the real world does ("natural mapping") are easier to learn and remember.
Example: Stovetop knobs laid out in the same arrangement as the burners, so you know which knob controls which element.

**3. User Control and Freedom**
Essence: People act by mistake. They need a clearly marked "emergency exit" — undo, cancel, a way out — so they never feel trapped. Easy reversal creates confidence.
Example: Just as physical buildings need clearly marked exits, digital flows need obvious cancel/undo.

**4. Consistency and Standards**
Essence: The same word or action should always mean the same thing. Follow platform and industry conventions (external consistency) and stay consistent within your own product (internal consistency). Breaking convention forces people to relearn.
Example: Hotel check-in counters are near the entrance; consistency across hotels meets the expectation.

**5. Error Prevention**
Essence: Good error messages matter, but preventing the error is better. Remove error-prone conditions, or ask for confirmation before a risky, committing action. Two error types: slips (inattention) and mistakes (wrong mental model).
Example: Guard rails on a mountain road stop the error before it happens.

**6. Recognition Rather Than Recall**
Essence: Minimise memory load. Keep options, actions and needed information visible or easy to retrieve, so people recognise rather than remember. Human short-term memory is limited.
Example: It is easier to confirm "Is Lisbon the capital of Portugal?" than to recall the capital unaided.

**7. Flexibility and Efficiency of Use**
Essence: Let novices succeed the simple way while giving experts accelerators (shortcuts, gestures, personalisation). One flow can serve both if the fast path stays out of the beginner's way.
Example: A map shows standard routes, but a local can take a known shortcut.

**8. Aesthetic and Minimalist Design**
Essence: Every extra unit of information competes with the essential ones and dilutes them. Keep content and visuals focused on the user's primary goal. This is about focus, not flat visuals.
Example: An ornate teapot with a beautiful but unusable handle sacrifices function for decoration.

**9. Help Users Recognise, Diagnose, and Recover from Errors**
Essence: Error messages should be in plain language (no codes), state the problem precisely, and offer a constructive way out. Use visual treatment (e.g. bold red) so people notice them.
Example: A "Wrong Way" road sign names the problem and tells the driver to stop.

**10. Help and Documentation**
Essence: Ideally the product needs no explanation, but when help is needed it should be searchable, task-focused, concise, and delivered in context with concrete steps.
Example: Airport information kiosks solve problems in context, right where they arise.

#### 1b. Norman's Core Concepts
Sources: https://www.nngroup.com/articles/ten-usability-heuristics/ (mapping, constraints, feedback referenced there); https://www.interaction-design.org/literature/topics/affordances (affordance/perceived affordance, per Don Norman, *The Design of Everyday Things*)

**Affordance** — Essence: The relationship between an object and a user that makes an action possible. A glass affords holding liquid. In screen interfaces the raw affordances are limited (click, tap, drag, type), so the design must make the *right* ones obvious.

**Perceived affordance / Signifier** — Essence: On screen, what matters is what the user *perceives* they can do, based on learned conventions and visual cues. A signifier is the perceptible cue (a button that looks pressable, an underline that says "link") that advertises the affordance. Consistency across products is what makes perceived affordances legible. Source: IxDF page above.

**Feedback** — Essence: Show the result of an action immediately, so users know it registered and worked. Without feedback people repeat actions or assume failure. (Same idea as Heuristic 1.)

**Mapping** — Essence: The correspondence between a control and its effect. Natural mapping (control layout mirrors the thing it controls, e.g. stovetop knobs) makes an interface feel intuitive. Source: Heuristic 2 page.

**Constraints** — Essence: Deliberately limiting possible actions prevents errors. Good defaults and disabling invalid options guide people onto the correct path. Source: Heuristic 5 page (slips avoided "by providing helpful constraints and good defaults").

**Conceptual model** — Essence: The user's internal understanding of how the system works. Mistakes happen when the design's model and the user's model diverge (Heuristic 5). Matching the real world (Heuristic 2) keeps the two models aligned.

---

### Chapter 2 — Psychology Laws with Product Consequences
Source hub: https://lawsofux.com/ (individual URLs below)

**Fitts's Law** — https://lawsofux.com/fittss-law/
Essence: The time to hit a target depends on its size and its distance. Bigger, closer targets are faster and more reliable to acquire; small or far ones cause misses.
Consequence: Make touch targets large, space them apart, and place frequent actions where the thumb already is.

**Hick's Law** — https://lawsofux.com/hicks-law/
Essence: Decision time grows with the number and complexity of choices.
Consequence: Minimise options when speed matters, break complex tasks into steps, highlight a recommended default. (Site examples: Google homepage, Apple TV remote, Slack's progressive onboarding.)

**Jakob's Law** — https://lawsofux.com/jakobs-law/
Essence: "Users spend most of their time on other sites. This means that users prefer your site to work the same way as all the other sites they already know."
Consequence: Lean on established patterns; leverage existing mental models rather than inventing new interactions.

**Miller's Law** — https://lawsofux.com/millers-law/
Essence: The average person holds about 7 (±2) items in working memory — but do not misuse "seven" as a design limit. The real lesson is chunking.
Consequence: Group content into meaningful chunks so it is easier to process and remember.

**Doherty Threshold** — https://lawsofux.com/doherty-threshold/
Essence: Productivity soars when the system responds in under 400ms, keeping neither person nor computer waiting.
Consequence: Keep interactions fast; use immediate visual feedback (skeletons, optimistic UI) when real work takes longer.

**Law of Proximity** — https://lawsofux.com/law-of-proximity/
Essence: Objects placed near each other are perceived as a group.
Consequence: Use spacing, not just lines, to signal which labels, numbers and controls belong together.

**Law of Common Region** — https://lawsofux.com/law-of-common-region/
Essence: Elements inside a shared, clearly bounded area are perceived as one group. A border or a background colour creates that region.
Consequence: Cards (white on grey) are a legitimate grouping device; the container itself communicates relationship.

**Serial Position Effect** — https://lawsofux.com/serial-position-effect/
Essence: People best remember the first and last items in a series; the middle fades.
Consequence: Put key actions/navigation at the start and end (edges); place least-important items in the middle.

**Peak-End Rule** — https://lawsofux.com/peak-end-rule/
Essence: People judge an experience by its most intense moment (the peak) and its ending, not the average. Negative moments are recalled more vividly than positive ones.
Consequence: Invest design effort in the emotional high points and the final moment of a flow. (Site examples: Mailchimp's send-success moment, Uber.)

**Aesthetic-Usability Effect** — https://lawsofux.com/aesthetic-usability-effect/
Essence: People perceive attractive design as more usable, and are more tolerant of minor problems in it.
Consequence: A calm, polished visual system (the "ANZ Plus" ambition) genuinely raises perceived quality — but it can also mask real usability issues, so still test.

---

### Chapter 3 — The Evaluation Method Itself

**How a heuristic evaluation is run** — https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/
Essence: Evaluators judge an interface against a set of heuristics to surface likely problems without recruiting users. Best practice:
- Use 3–5 evaluators; each reviews **independently** first (no one sees others' notes until done), because a single evaluator misses most issues.
- **Narrow the scope**: one task, one section, one user group, one device at a time.
- Two passes: first move through the task just to learn it; second pass, note each element that violates a heuristic, with a recommendation.
- Then **consolidate**: cluster issues (affinity diagram), discuss agreement/disagreement, and prioritise.
- A heuristic violation is not automatically a defect — context can justify it. Heuristic evaluation complements but does not replace user testing.

**Severity scale (0–4)** — https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/
Severity combines three factors: **frequency** (common vs rare), **impact** (easy vs hard to overcome), **persistence** (one-time vs repeated). Rate each issue:
- **0** = Not a usability problem at all.
- **1** = Cosmetic only — fix only if spare time.
- **2** = Minor usability problem — low priority.
- **3** = Major usability problem — important, high priority.
- **4** = Usability catastrophe — imperative to fix before release.
Collect severity ratings *after* the finding phase (a separate pass), and average across evaluators — single-evaluator severity is unreliable; the mean of three is satisfactory.

**Cognitive walkthrough — and how it differs** — https://www.nngroup.com/articles/cognitive-walkthroughs/
Essence: A task-based method focused on **learnability for a new user**. At each step of a task, the team asks four questions:
1. Will users try to achieve the right result?
2. Will users notice that the correct action is available?
3. Will users associate the correct action with the result they want?
4. After acting, will users see that progress was made toward the goal?
If any answer is "No," that step fails.
Difference from heuristic evaluation (per NN/g's comparison table): perspective is the *new user* (vs the analyst); target is *learnability* (vs general usability); scope is *targeted tasks* (vs comprehensive); method is *exploring user reactions step by step* (vs judging the whole interface against guidelines).

---

### Chapter 4 — Mobile Ergonomics

**Touch-target minimums**
- Apple: a control needs a hit region of **at least 44×44 pt** (60×60 pt in visionOS). Sources: https://developer.apple.com/design/human-interface-guidelines/buttons and https://developer.apple.com/design/tips ("Create controls that measure at least 44 points x 44 points").
- Material Design (M3): make touch targets **at least 48×48 dp**, ≈9mm physical regardless of screen. Source: https://m3.material.io/foundations/designing/structure
- WCAG 2.2 SC 2.5.8 (AA): pointer targets **at least 24×24 CSS px**, or with sufficient spacing. Source: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
Consequence for this app (non-technical users, iPhone): treat 44pt as the floor and prefer more.

**Thumb zones and one-handed use** — https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/ (based on Steven Hoober's research)
Essence: ~49% of people hold their phone one-handed (Hoober); ~75% of interactions are thumb-driven (Josh Clark). The screen splits into easy-to-reach, hard-to-reach, and in-between zones. The bottom and centre are easiest; the top corners are hardest for the thumb.
Consequence: Put primary actions and navigation in the bottom, easy-reach band; avoid placing critical, frequent controls in the top corners.

**Navigation patterns** (same source): long link lists suit a full-screen overlay menu; short sets suit a sticky bottom menu (example cited: Airbnb's bottom sticky menu) which keeps key actions in the thumb zone.

---

### Chapter 5 — Forms and Data Entry

**Question pages / structure** — https://design-system.service.gov.uk/patterns/question-pages/
- Ask only what you truly need; know why you ask each question.
- Prefer **one question per page** — it focuses the user and helps screen-reader users (label/legend doubles as the page heading).
- Mark **optional** fields with "(optional)"; **never** mark mandatory fields with asterisks.
- Every question page needs a back link, a page heading, and a continue button. Label it **"Continue," not "Next,"** and left-align it.
- Never ask for the same information twice in a journey; pre-populate or offer carried-forward answers.
- Hint text: one short sentence, no full stop, no links inside it.

**Validation timing** — https://www.nngroup.com/articles/error-message-guidelines/
Essence: "Avoid prematurely displaying errors." Showing an error before the user has finished (or before they have even typed) is a hostile pattern.
Consequence: Validate a field after the user leaves it / finishes it, not on every keystroke.

**Error recovery** — https://design-system.service.gov.uk/components/error-message/
- **Do not clear the fields** when showing an error — keep both correct and incorrect answers so people can see and edit what went wrong.
- Put the message in red, after the label/hint, with a red border tying it to the field; also summarise all errors at the top (error summary).
- Be specific: avoid "An error occurred," "This field is required." Say what happened and how to fix it, echoing the label's wording ("Enter how many hours you work a week").
- Plain English only. Avoid jargon/codes, and avoid "please," "sorry," "valid/invalid," "oops."

**Forgiving input (for less-technical/older users)** — https://www.nngroup.com/articles/usability-for-senior-citizens/
Accept input in more than one format; don't punish hyphens, spaces or parentheses in phone/card numbers; let people type or speak values rather than forcing fiddly pickers.

---

### Chapter 6 — Content and Microcopy

**Plain language** — https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/
- Plain English is mandatory; even specialists prefer it (80% preferred clear English; preference rises with expertise and complexity).
- Use short, everyday words ("buy" not "purchase," "help" not "assist"). Avoid buzzwords and –ion/–ment nominalisations.
- Explain any necessary specialist term on first use.
- Use the words your users use (check real search terms — "lorry" vs "heavy goods vehicle").
- Be careful with contractions: "you'll" is fine, but negative contractions like "can't"/"don't" are often misread — prefer "cannot"/"do not" for critical instructions.
- Use "must" for requirements; use the active voice.

**Product-interface copy** — https://polaris.shopify.com/content/fundamentals (served as polaris-react.shopify.com/content/fundamentals)
- Weigh every word; only add copy that aids clarity. Ask "could this be an icon?"
- Keep it lean (the "Jenga" test — remove until it would break).
- Write like users talk; aim ~7th-grade reading level; read it aloud.
- Inspire action: focus on the one next thing, start sentences with verbs ("Add apps," not "You can add apps"), use size/position to signal importance, and break multi-part tasks into steps (progressive disclosure).
Consequence for this app: pick one term per concept and use it everywhere (terminology consistency = Heuristic 4). Quote UI strings in Hebrew, e.g. keep a single word for "expense," a single label for "all clear," etc.

---

### Chapter 7 — Accessibility and Inclusive Design

**Contrast** — https://webaim.org/articles/contrast/
- Text (AA, 1.4.3): **4.5:1** normal, **3:1** large. Large = 18pt/24px, or 14pt/18.67px if bold. You cannot round up (#777 at 4.47:1 fails).
- Non-text (AA, 1.4.11): **3:1** for UI component boundaries and meaningful graphical objects, measured against adjacent colours.
- Enhanced (AAA, 1.4.6): 7:1 normal / 4.5:1 large.
- Use of Colour (1.4.1): never convey meaning by colour alone. (See Chapter 8.)

**Target size** — WCAG 2.2 SC 2.5.8: 24×24 CSS px minimum (see Chapter 4 for platform figures).

**Designing for older / less-technical users** — https://www.nngroup.com/articles/usability-for-senior-citizens/
Essence: Ability to use websites declines ~0.8%/year between 25 and 60 — so this is not only about the over-65s. Common failures: tiny text, low contrast, small targets, inflexible/unforgiving input, and error messages that are obscure or easy to miss.
Consequence: Larger text and targets, high contrast, forgiving input, and error handling that "focus[es] on the error, explain[s] it clearly, and make[s] it as easy as possible to fix."

---

### Chapter 8 — Numbers and Finance UX

**Colour must never be the only signal** — https://webaim.org/articles/contrast/ (WCAG 1.4.1 Use of Color)
Essence: Information carried by colour alone excludes colour-blind users and misleads in bright light. In finance, green/red for gain/loss must be paired with a sign, arrow, icon, or label.

**Aligning amounts with tabular figures** — corroborated across typographic references: https://www.myfonts.com/pages/fontscom-learning-fontology-level-3-numbers-figures (tabular figures share one width, so they align vertically in tables, price lists and financial statements); https://typenetwork.com/article/opentype-at-work-figure-styles (use lining figures where numbers must align).
Essence: Use **tabular (fixed-width) lining figures** and **right-align** numeric columns so digits and decimal points line up; keep decimal places consistent (show trailing zeros). This makes ledgers and forecasts scannable and comparable.
Consequence for this app: the declared `tabular-nums` token is the correct choice — apply it wherever amounts stack or compare (ledger rows, forecast rows, equity figures).

**Trust and clarity (canon applied)**: Visibility of status (Heuristic 1) + Doherty (<400ms) build trust in a money app; a single clear number per moment (Aesthetic-Minimalist, Heuristic 8) is the calm-banking ideal; feedback on every committing action (Heuristic 5) reassures non-technical users handling financial data.

---

### Chapter 9 — RTL and Localization

**The definitive CSS/RTL guide** — https://rtlstyling.com/posts/rtl-styling/ (Ahmad Shadeed)
- Set `dir="rtl"` on the root; headings, paragraphs, links, images and form elements flip automatically. Flexbox and CSS Grid flip with the writing mode — a major benefit.
- **What flips** (RTL Design Considerations): back/next/previous and other order-based navigation, breadcrumb arrows, tab icon-vs-label order, horizontal card image/text order, toggle switches, page-header start/end sections, tables, menu ("more actions") button icons, and the send icon in messaging.
- **What never flips**: symmetrical icons; media playback icons (play/forward represent tape direction, not time — Spotify keeps them unflipped); email, phone-number and numeric inputs stay left-aligned (placeholder aligns right if it is Hebrew, then flips to left once typing a Latin/number value).
- Common mistakes: keep `letter-spacing: 0` for Arabic/Hebrew (letters must stay connected); avoid RGBa/opacity on text colour (rendering artifacts); allow for word-size differences (set `min-width` on short buttons); pick a proper RTL font; be consistent with numerals.

**Apple's official mirroring rules** — https://developer.apple.com/design/human-interface-guidelines/right-to-left
- System frameworks flip standard components automatically; fine-tune only where needed.
- **Never reverse the digit order within a specific number** — a phone number, credit-card number or "541" always reads in the same order. **Hebrew uses Western Arabic numerals** (0-9).
- Reverse the *order* of numerals that show progress/counting to match a flipped control — but never flip the numerals themselves.
- Flip controls that show progress (sliders, progress bars) and controls that navigate an ordered sequence (a back button points **right** in RTL). **Preserve** controls that refer to a real-world direction or point at an on-screen area.
- Align one/two-line text to the current context, but align a paragraph (3+ lines) to *its own language*. Don't flip photographs. Consider bumping Hebrew/Arabic font ~2pt when adjacent to all-caps Latin, so it doesn't look too small.

**Material Design bidirectionality**: (Not opened directly this session — see Gaps.) Its guidance aligns with the above (mirror layout and directional icons; keep numerals and media controls). Treat Apple HIG + rtlstyling.com as the primary authorities used here.

---

## PART 2 — THE EVALUATION INSTRUMENT

### How to run this

1. **Scope one thing at a time**: a single screen, or one 30-second interaction (per NN/g, narrow scope = better findings).
2. **Evaluate independently**, 3–5 people, before comparing notes. Do a learning pass, then an evaluation pass.
3. **Record evidence per finding**: screen, element, what you observed, which principle it relates to. One observation per line.
4. **Score severity 0–4** in a separate pass, then average across evaluators:
   - 0 = not a problem · 1 = cosmetic · 2 = minor (low priority) · 3 = major (high priority) · 4 = catastrophe (fix before release).
   - Weigh frequency × impact × persistence.
5. **Do not fix while scoring.** Consolidate and prioritise afterwards.
6. A violated item is a *candidate* problem — note context; confirm with user testing where it matters.

Each item: **the question** · *(principle → traceability)* · **what to look at**.

---

### Lens A — First impression & hierarchy

1. Is there one clearly dominant element (ideally one number/message) on first view? *(Aesthetic-Minimalist H8; Miller)* — Look at what the eye lands on first; count competing focal points.
2. Is the most important information visible without scrolling? *(H8; Serial Position)* — Check what sits above the fold on a standard iPhone.
3. Does visual weight (size, colour, position) match actual importance? *(Polaris "use design to communicate importance")* — Compare the biggest element to the user's real priority.
4. Is screen space free of repeated or redundant messaging? *(H8)* — Look for duplicated statements or stacked headers.
5. Are related items visually grouped by proximity and/or a shared container? *(Proximity; Common Region)* — Check spacing and card/background boundaries.
6. Is the number of choices on the screen kept to what's needed? *(Hick)* — Count simultaneous options/CTAs.

### Lens B — Navigation & orientation

7. Can the user always tell where they are in the app? *(H1)* — Look for a screen title / active tab indicator.
8. Is there always an obvious way out or back (cancel/undo/back)? *(H3)* — Check every screen for an exit.
9. Do primary navigation and key actions sit at the start/end (edges), not buried in the middle? *(Serial Position)* — Check nav order.
10. Do interface patterns match conventions users know from other apps? *(H4; Jakob)* — Compare to standard iOS/banking patterns.
11. Is terminology for the same concept identical everywhere? *(H4; Polaris)* — Track one concept's label across screens.
12. Are the same control types styled consistently for the same purpose? *(H4)* — Compare single-select controls, buttons, tags across screens.

### Lens C — Forms & input

13. Does the screen ask only for information that's truly needed? *(GOV.UK question pages)* — Question each field's necessity.
14. Is each field's label visible and does it stay visible while typing? *(H6; GOV.UK)* — Check for placeholder-only labels.
15. Are optional fields marked "(optional)" and mandatory ones left unmarked (no asterisks)? *(GOV.UK)* — Scan field labels.
16. Is the primary button clearly labelled with a verb ("Continue"/save action), not "Next"? *(GOV.UK; Polaris)* — Read the button.
17. Are good defaults and constraints used to prevent invalid entries? *(H5; Norman constraints)* — Check pickers, input types, pre-fills.
18. Does the form accept input in the formats users naturally type (e.g. spaces/hyphens in numbers)? *(NN/g older users)* — Try alternative formats.
19. Is information the user already gave never requested again? *(GOV.UK)* — Look for repeated asks across a flow.
20. Do input fields use the right mobile keyboard/type (numeric keypad for amounts, etc.)? *(H5; ergonomics)* — Tap each field, check keyboard.

### Lens D — Feedback, errors & recovery

21. Does every action with consequences produce immediate, visible feedback? *(H1; Feedback)* — Tap and watch for confirmation.
22. Does the system respond (or show progress) within ~400ms? *(Doherty)* — Time the response; check for skeletons/spinners on slow work.
23. Are validation errors shown *after* the user finishes a field, never prematurely? *(NN/g error guidelines)* — Type partial input, watch timing.
24. When an error appears, are the user's entered values preserved? *(GOV.UK)* — Trigger an error, check fields aren't cleared.
25. Are error messages plain-language, specific, and do they say how to fix it? *(H9; GOV.UK)* — Read the message; check for jargon/codes.
26. Are destructive/irreversible actions confirmed or undoable, and not triggered by an ambiguous icon? *(H3; H5)* — Find delete/remove actions; check for confirm or undo.
27. Is there a clear, single "success/complete" moment at the end of a task? *(Peak-End; H1)* — Complete a flow; observe the ending.

### Lens E — Content & microcopy

28. Would a non-technical family member understand every word without a glossary? *(H2; GOV.UK; Polaris)* — Read as a layperson.
29. Is any specialist/financial term explained on first use? *(GOV.UK)* — Note undefined jargon.
30. Is copy lean — nothing that could be removed without losing clarity? *(H8; Polaris)* — Try deleting each phrase mentally.
31. Are "empty" / "all clear" states phrased consistently across screens? *(H4)* — Compare wording of nothing-to-do states.
32. Do calls to action start with a verb and describe the outcome? *(Polaris)* — Read each button/link.
33. Are negative contractions avoided in critical instructions? *(GOV.UK)* — Look for "can't/don't" in key messages.

### Lens F —

---

> **NOTE (added at packaging time):** the source document was truncated at this point when handed over — Lens F onward is missing. Part 1 (the full primer, Chapters 1–9) and Lenses A–E (items 1–33) are complete and authoritative. Treat missing lenses as not provided; do not invent their contents. The measurable items for the live run are drawn from what exists here.
