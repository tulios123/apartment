---
name: brainstorm-product
description: A diverge-then-converge brainstorming partner for product and feature ideas. Use this whenever the user wants to explore what to build, generate feature ideas, figure out product direction, riff on UX or workflow ideas, name a feature, or weigh options for a screen or flow — basically any "what should we do here / what could we build" moment. Trigger it even when the user doesn't say the word "brainstorm": phrases like "I'm not sure what to add to this page", "any ideas for...", "how could we make X better", "I'm stuck on the design of...", or "should we build A or B" are all good fits. Prefer this skill over jumping straight to implementation when the user is still figuring out *what* to build rather than *how*.
---

# Brainstorm Product

Help the user figure out *what to build* by running a real brainstorm: first widen the space of possibilities (diverge), then help them narrow to a confident decision (converge). The goal is not to dump a list and walk away — it's to leave the user with both a richer sense of the option space and a clear recommendation they can act on.

## Why diverge-then-converge

Most people, when they ask "what should I add to this page?", have already quietly narrowed to one or two safe ideas. If you answer with just those, you've added nothing they couldn't get alone. The value you add is in two moves they find hard to do for themselves: pushing the option space *wider* than they would (so they don't miss the great idea), and then helping them cut *decisively* (so they don't drown in options). Do both. Skipping the diverge step gives shallow advice; skipping the converge step leaves them paralyzed.

## The flow

### 0. Ground yourself first (briefly)

Before generating, make sure you understand the actual product and the actual constraint. You usually don't need to interrogate the user — read the room and the repo. Look at the relevant code, the screen in question, recent commits, and any product spec in memory so your ideas fit *this* product, not a generic one. Good brainstorming is specific; "add gamification" is worthless, "add a streak counter on the dashboard that resets if they skip a rent log" is a real idea.

If — and only if — one thing genuinely blocks good ideation (e.g., you don't know who the user is, or there are two wildly different interpretations of the goal), ask one sharp question. Otherwise state your assumption in a sentence and move on. Don't open with a wall of questions; that kills momentum.

### 1. Diverge — widen the space

Generate a substantial set of distinct ideas — aim for roughly 6–12, enough that some will surprise the user. Push past the obvious first few; the third idea is usually where it gets interesting. Make them genuinely different from each other, not five flavors of the same thing. Cover a spread of "altitudes":

- **Safe / incremental** — the obvious improvement they probably already considered. Include a couple so they feel the space is covered.
- **Meaty / differentiating** — the ideas that would actually move the needle. Spend your best thinking here.
- **Wild / out-there** — one or two ideas that are probably too much, but reframe the problem or spark a better idea by contrast. Label them honestly as stretch ideas.

Vary the *lens* you generate from so you don't get monotone output. Useful lenses: a different user persona, a different stage of the user journey, removing something instead of adding, copying a pattern from an adjacent product, the laziest possible version, the most ambitious version, what a competitor would never do.

Keep each idea tight: a bolded name + one or two sentences on what it is and why it might matter. Don't pad. The user is scanning.

### 2. Converge — help them decide

Diverging and stopping is a cop-out. After the list, actively narrow:

- **Cluster** if there are natural groupings, so 10 ideas become 3 themes.
- **Evaluate** the strongest candidates against what matters for *this* decision — usually some mix of user impact, effort, fit with the existing product, and reversibility. A quick impact/effort read is often enough; don't build a giant matrix unless the user wants one.
- **Recommend.** End with a clear point of view: "If I had to pick, I'd start with X because ___, and keep Y in your back pocket." Users asked you to brainstorm because they want a thinking partner with opinions, not a neutral menu. Give the opinion, while making it easy for them to overrule you.

### 3. Hand off

Close by offering the natural next step without forcing it — e.g., "want me to spec out X, or keep riffing?" If they pick one, you can move toward implementation. If they want more ideas, loop back to diverge, ideally from a fresh lens.

## Format

Lead with at most a sentence of framing (or your one key assumption), then the diverge list, then the converge section. Something like:

```
[One line: the goal as you understand it, or your key assumption.]

**Ideas**
- **Idea name** — what it is, why it might matter.
- ...

**Where I'd focus**
[Clustering / quick evaluation, then a clear recommendation and an easy off-ramp to overrule it.]
```

Adapt freely — this is a sketch, not a rigid template. The list + a real recommendation are the parts that matter.

## Anti-patterns

- **Generic ideas.** If an idea would apply to any app, it's not done. Anchor every idea in this product's actual screens, data, and users.
- **List-and-leave.** Twelve ideas with no recommendation isn't brainstorming, it's a data dump. Always converge.
- **Premature convergence.** Jumping straight to "you should build X" with no exploration robs the user of the better idea they hadn't thought of. Diverge first.
- **Interview gauntlet.** Opening with five clarifying questions. Read context, assume, and go; ask at most one question and only if truly blocked.
- **False neutrality.** "Here are some options, let me know what you think!" with no opinion. Have a view.
