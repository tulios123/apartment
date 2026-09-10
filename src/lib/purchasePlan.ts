// לוח התשלומים — the centre of the stage between signing and the key.
//
// From the interview (09.09, docs/specs/purchase-stage.md): the app's job here is NOT a
// to-do list. It is one chronological run of payments and actions, ordered by the PROCESS,
// with the next payment as the headline number.
//
// Two things this file gets from the owner's own deal rather than from general knowledge:
//
//  1. **The spine is gates, not dates.** The banker's cheque sits in trust with the lawyer
//     until the caution is registered in טאבו; the second payment is due within a month of
//     the cheque's RELEASE, not of the signing. So an item's date can depend on when an
//     earlier item actually happened — `doneAt` carries that, and `resolveDates` applies it.
//  2. **The split varies.** He paid 10% then 15%; others do 15% then 10%, or three. The
//     percentages come from him; the shekels come from us. That is the whole point — it is
//     the arithmetic he told us he keeps redoing by hand.
//
// Certainty follows the rule he chose: **editing is confirming.** There is no "approved"
// state in between. A figure the app derived is a forecast; one he touched, or one that has
// happened, is certain. Nothing is ever marked as a forecast on screen — the SETTLED items
// are marked, so the screen fills up instead of starting covered in caveats.
//
// STORAGE, and why it is where it is: the plan lives in localStorage, per user, until the
// shape is agreed. It is deliberately behind this module's four functions so moving it to
// Postgres is a change to this file only (migration 050 is written and waiting). The owner
// asked for something physical to look at tonight; blocking on a migration he has to run
// himself would have delivered an empty screen instead.

import { monthDayISO, parseLocalISO, todayISO } from './format'
import { purchaseTax } from './purchaseTax'

export type ItemKind = 'payment' | 'cost' | 'gate' | 'task'

/** Who moves it — the classification the owner asked for, and it drives the row's control. */
export type Dependency =
  | 'date'   // a deadline in law or in the contract; nothing you tap moves it
  | 'you'    // nothing external is waiting
  | 'third'  // you started it and now you wait for someone

/**
 * The three stages are the owner's own sentence, not a taxonomy I invented:
 * "מקובל לשלם ב-3 תשלומים — חתימה 10/15%, חודש — עד כאן הון עצמי. מסירת מפתח (משכנתא)."
 * Raise the equity · turn it into a flat · tie off the loose ends.
 */
export const STAGES = [
  { n: 1 as const, title: 'ההון העצמי', closes: 'ההון העצמי שולם במלואו' },
  { n: 2 as const, title: 'המשכנתא והמסירה', closes: 'המפתח אצלך' },
  { n: 3 as const, title: 'הסגירה', closes: 'הבעלות רשומה' },
]
export type StageNo = 1 | 2 | 3

export interface PlanItem {
  id: string
  kind: ItemKind
  stage: StageNo
  label: string
  /** 0 for gates and tasks. */
  amount: number
  dep: Dependency
  /** Who you are waiting for, when dep === 'third'. */
  waitingOn?: string
  /** The one line worth knowing — a legal deadline, a duration, a caveat. Label length. */
  note?: string
  /** Fixed date, or null when the date only exists once an earlier gate opens. */
  due: string | null
  /** `after` waits for that item id, then adds `afterDays`. Resolved by resolveDates. */
  after?: string
  afterDays?: number
  done: boolean
  /** When it actually happened — this is what dates whatever waits on it. */
  doneAt?: string
  /** True once the number is his (he typed it) or it has happened. */
  certain: boolean
}

export interface PurchasePlan {
  version: 1
  price: number
  /** Signing and handover come from the property record; kept here so the plan is self-contained. */
  signing: string
  handover: string
  firstPct: number
  secondPct: number
  singleApartment: boolean
  items: PlanItem[]
}

const KEY = (uid: string) => `purchase_plan:${uid}`

function shift(iso: string, days: number): string {
  const d = parseLocalISO(iso)
  d.setDate(d.getDate() + days)
  return monthDayISO(d)
}

const pct = (price: number, p: number) => Math.round(price * p / 100)

/**
 * The default plan: his lawyer's chain, with the two equity payments at the percentages he
 * gives and the mortgage taking the rest. Costs come in only when we know them — a cost we
 * cannot compute is not invented, it is left out and can be added.
 */
export function buildPlan(input: {
  price: number
  signing: string
  handover: string
  firstPct: number
  secondPct: number
  singleApartment: boolean
  costs?: { label: string; amount: number }[]
}): PurchasePlan {
  const { price, signing, handover, firstPct, secondPct, singleApartment } = input
  const mortgagePct = Math.max(0, 100 - firstPct - secondPct)
  const tax = purchaseTax(price, singleApartment)

  const items: PlanItem[] = [
    {
      id: 'pay1', stage: 1, kind: 'payment', label: `תשלום ראשון · ${firstPct}%`, amount: pct(price, firstPct),
      dep: 'date', due: signing, note: 'צ׳ק בנקאי — הכסף צריך לשבת בעו״ש',
      done: false, certain: true,
    },
    {
      id: 'caution', stage: 1, kind: 'gate', label: 'הערת אזהרה בטאבו', amount: 0,
      dep: 'third', waitingOn: 'עורך הדין', due: null,
      note: 'הצ׳ק משוחרר מהנאמנות רק אחריה', done: false, certain: true,
    },
    {
      id: 'pay2', stage: 1, kind: 'payment', label: `תשלום שני · ${secondPct}%`, amount: pct(price, secondPct),
      dep: 'date', due: null, after: 'caution', afterDays: 30,
      note: 'עד חודש משחרור הצ׳ק', done: false, certain: true,
    },
    {
      id: 'tax-report', stage: 1, kind: 'task', label: 'דיווח לרשות המסים', amount: 0,
      dep: 'you', due: shift(signing, 30), note: 'חובה חוקית · 30 יום מהחתימה',
      done: false, certain: true,
    },
    {
      id: 'tax-pay', stage: 1, kind: 'cost', label: 'תשלום מס רכישה', amount: tax,
      dep: 'date', due: shift(signing, 60),
      note: singleApartment
        ? 'חובה חוקית · 60 יום מהחתימה · דירה יחידה'
        : 'חובה חוקית · 60 יום מהחתימה · דירה נוספת',
      done: false, certain: true,
    },
    {
      id: 'insurance', stage: 2, kind: 'task', label: 'ביטוח חיים וביטוח מבנה', amount: 0,
      dep: 'you', due: shift(handover, -30),
      note: 'תנאי לביצוע המשכנתא. מקבלן — אפשר לבקש שהפרמיה תתחיל במסירה',
      done: false, certain: true,
    },
    {
      id: 'drawdown', stage: 2, kind: 'gate', label: 'ביצוע המשכנתא', amount: 0,
      dep: 'third', waitingOn: 'הבנק', due: shift(handover, -14),
      note: 'הבנק מסלק קודם את המשכנתא של המוכר', done: false, certain: true,
    },
    {
      id: 'lien', stage: 2, kind: 'gate', label: 'ירידת השיעבוד של המוכר', amount: 0,
      dep: 'third', waitingOn: 'המוכר', due: null, after: 'drawdown', afterDays: 14,
      note: 'רק אחריה מעבירים את היתרה', done: false, certain: true,
    },
    {
      id: 'pay3', stage: 2, kind: 'payment', label: `יתרת התשלום · ${mortgagePct}%`, amount: pct(price, mortgagePct),
      dep: 'date', due: handover, note: '~5% נשארים בנאמנות עד אישורי העירייה',
      done: false, certain: true,
    },
    {
      id: 'handover', stage: 2, kind: 'gate', label: 'מסירת המפתח', amount: 0,
      dep: 'date', due: handover, note: 'מפתח + הצ׳קים של השוכרים', done: false, certain: true,
    },
    {
      id: 'utilities', stage: 3, kind: 'task', label: 'חשמל, מים, ארנונה וועד על שמך', amount: 0,
      dep: 'you', due: shift(handover, 3), done: false, certain: true,
    },
    {
      id: 'registration', stage: 3, kind: 'gate', label: 'רישום הבעלות בטאבו', amount: 0,
      dep: 'third', waitingOn: 'עורך הדין', due: null, after: 'handover', afterDays: 30,
      note: 'המפתח הקנייני', done: false, certain: true,
    },
    {
      id: 'approvals', stage: 3, kind: 'gate', label: 'אישורי עירייה ורשות המיסים מהמוכר', amount: 0,
      dep: 'third', waitingOn: 'המוכר', due: shift(signing, 240),
      note: 'עד 8 חודשים מהחתימה — עד אז ~5% בנאמנות', done: false, certain: true,
    },
  ]

  // Costs the app already holds. They are his figures, so they are certain; the timing is
  // ours, so it is the part he is most likely to correct.
  for (const c of input.costs ?? []) {
    if (!(c.amount > 0)) continue
    items.push({
      id: `cost-${c.label}`, kind: 'cost', stage: 1, label: c.label, amount: c.amount,
      dep: 'date', due: signing, note: 'סביב החתימה', done: false, certain: true,
    })
  }

  return { version: 1, price, signing, handover, firstPct, secondPct, singleApartment, items }
}

/**
 * Fill in the dates that only exist once an earlier gate has actually happened. An item that
 * waits on something unfinished keeps `due: null` — which is the truth, and is what makes the
 * row read "ממתין ל…" instead of showing a date the app invented.
 */
export function resolveDates(plan: PurchasePlan): PlanItem[] {
  const byId = new Map(plan.items.map(i => [i.id, i]))
  const resolved = plan.items.map(i => {
    if (i.due || !i.after) return i
    const src = byId.get(i.after)
    if (!src?.done || !src.doneAt) return i
    return { ...i, due: shift(src.doneAt, i.afterDays ?? 0) }
  })

  // Chronological, which is the map's whole promise — a cost paid at signing belongs beside
  // the signing, not at the bottom because it was appended last. An item with no date of its
  // own inherits the last known date so it sits where it belongs in the run rather than
  // sinking to the end; ties keep the spine's order.
  let carried = plan.signing
  const keyed = resolved.map((item, idx) => {
    if (item.due) carried = item.due
    return { item, idx, key: item.due ?? carried }
  })
  return keyed
    .sort((a, b) => a.key.localeCompare(b.key) || a.idx - b.idx)
    .map(k => k.item)
}

/** The next thing that costs money — the headline number the owner asked for. */
export function nextPayment(plan: PurchasePlan): PlanItem | null {
  const items = resolveDates(plan)
    .filter(i => !i.done && i.amount > 0)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  return items[0] ?? null
}

/** The first item still open, money or not — "what's my next step". */
export function nextStep(plan: PurchasePlan): PlanItem | null {
  return resolveDates(plan).find(i => !i.done) ?? null
}

export interface StageState {
  n: StageNo
  title: string
  closes: string
  items: PlanItem[]
  done: boolean
  doneCount: number
  /** Money that leaves his pocket in this stage — what a closed stage's summary says. */
  paid: number
  /** What this stage costs him in total, marked or not — so a folded stage says something
      worth knowing ("5 פריטים" said nothing; "₪39,000 מהכיס" is why he'd open it). */
  total: number
  /** The last thing that closed here, so a finished stage can say WHEN. */
  closedAt: string | null
}

/**
 * The three stages, resolved. A stage is finished when everything in it is; the current one
 * is the first that is not. That is all the state the accordion needs — no stored "current
 * stage" to drift out of sync with the items themselves.
 */
export function stages(plan: PurchasePlan): StageState[] {
  const items = resolveDates(plan)
  return STAGES.map(s => {
    const mine = items.filter(i => i.stage === s.n)
    const done = mine.length > 0 && mine.every(i => i.done)
    const dates = mine.map(i => i.doneAt).filter(Boolean) as string[]
    return {
      ...s,
      items: mine,
      done,
      doneCount: mine.filter(i => i.done).length,
      paid: mine.filter(i => i.done && i.amount > 0 && i.id !== 'pay3').reduce((a, i) => a + i.amount, 0),
      total: mine.filter(i => i.amount > 0 && i.id !== 'pay3').reduce((a, i) => a + i.amount, 0),
      closedAt: dates.length ? dates.sort().at(-1)! : null,
    }
  })
}

/** The stage the owner is in — the first unfinished one, or the last if everything is done. */
export function currentStage(plan: PurchasePlan): StageNo {
  const st = stages(plan)
  return (st.find(s => !s.done)?.n ?? st[st.length - 1].n)
}

export interface PlanTotals {
  /** Everything that leaves his pocket: the equity payments plus every cost. */
  fromPocket: number
  paid: number
  left: number
  paidPct: number
}

/**
 * The mortgage is not his money, so it is not part of the target. This is the number he
 * described: "כמה כסף הולך לצאת בסוף בסה״כ מהכיס".
 */
export function planTotals(plan: PurchasePlan): PlanTotals {
  const mine = plan.items.filter(i => i.amount > 0 && i.id !== 'pay3')
  const fromPocket = mine.reduce((s, i) => s + i.amount, 0)
  const paid = mine.filter(i => i.done).reduce((s, i) => s + i.amount, 0)
  return { fromPocket, paid, left: fromPocket - paid, paidPct: fromPocket > 0 ? paid / fromPocket * 100 : 0 }
}

// ── Storage ───────────────────────────────────────────────────────────────────
// Temporary and local, on purpose (see the header). Every read is defensive: a plan written
// by an older build must never take a screen down.

export function loadPlan(uid: string): PurchasePlan | null {
  try {
    const raw = localStorage.getItem(KEY(uid))
    if (!raw) return null
    const p = JSON.parse(raw) as PurchasePlan
    return p?.version === 1 && Array.isArray(p.items) ? p : null
  } catch { return null }
}

export function savePlan(uid: string, plan: PurchasePlan): void {
  try { localStorage.setItem(KEY(uid), JSON.stringify(plan)) } catch { /* private mode */ }
}

export function clearPlan(uid: string): void {
  try { localStorage.removeItem(KEY(uid)) } catch { /* ignore */ }
}

/** Mark an item done (or undone) — and stamp WHEN, because later items are dated from it. */
export function setDone(plan: PurchasePlan, id: string, done: boolean): PurchasePlan {
  return {
    ...plan,
    items: plan.items.map(i => i.id === id
      ? { ...i, done, doneAt: done ? todayISO() : undefined }
      : i),
  }
}

/** Editing IS confirming: a figure he touched is his, and never moves on its own again. */
export function setAmount(plan: PurchasePlan, id: string, amount: number): PurchasePlan {
  return { ...plan, items: plan.items.map(i => i.id === id ? { ...i, amount, certain: true } : i) }
}
