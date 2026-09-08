// The purchase process as DATA, so its shape can be argued about before anything is built
// on it. Every row here traces to docs/specs/purchase-process.md, which traces to a source.
//
// This file deliberately does NOT touch tasks, the database, or the home screen. It exists
// to be looked at (staging-only preview) and corrected — the owner's judgement on 08.09 was
// that the seeded checklist was "far off", and the fault was inventing the process instead
// of learning it. So: learn it, draw it, agree, and only then build.

import { parseLocalISO, monthDayISO } from '../../lib/format'

/**
 * How an item moves — the classification the owner asked for, and the reason this file
 * exists. Each class needs a DIFFERENT control, which is the whole design question:
 *  - `date`  a deadline in law or in the contract. Arrives whether or not you act.
 *  - `you`   nothing external is waiting. You could do it tonight.
 *  - `third` you start it and then wait for a bank, a lawyer, a builder, an authority.
 *            It does not "complete" — it changes state.
 */
export type Dependency = 'date' | 'you' | 'third'

/** What the item's date is measured from. Two clocks, not one — this is finding #1. */
export type Anchor = 'signing' | 'handover' | 'monthly' | 'none'

export interface ProcessItem {
  id: string
  title: string
  dep: Dependency
  anchor: Anchor
  /** Days from the anchor. Negative = before it. Ignored for `monthly` and `none`. */
  offset?: number
  /** The one line worth knowing — a deadline, a duration, a cost. Label length, not prose. */
  note?: string
  /** Who you are waiting for, when dep === 'third'. */
  waitingOn?: string
  /** True where the fact is specific to buying from a developer. */
  developerOnly?: boolean
}

export interface ProcessPhase {
  id: string
  title: string
  /** Said once per phase so no row has to repeat which clock it is on. */
  clock: string
  items: ProcessItem[]
}

export const PROCESS: ProcessPhase[] = [
  {
    id: 'signing',
    title: 'מהחתימה והלאה',
    clock: 'נספר מיום חתימת החוזה',
    items: [
      { id: 'caution', title: 'הערת אזהרה בטאבו', dep: 'third', anchor: 'signing', offset: 7,
        waitingOn: 'עורך הדין', note: 'לרוב תנאי להעברת התשלום הראשון' },
      { id: 'tax-report', title: 'דיווח לרשות המסים', dep: 'date', anchor: 'signing', offset: 30,
        note: 'חובה חוקית · 30 יום' },
      { id: 'tax-pay', title: 'תשלום מס רכישה', dep: 'date', anchor: 'signing', offset: 60,
        note: 'חובה חוקית · 60 יום · איחור עולה ריבית והצמדה' },
      { id: 'tax-defer', title: 'להחליט אם לדחות את תשלום המס', dep: 'you', anchor: 'none',
        note: 'אפשרי עד קבלת החזקה — אבל עולה ריבית והצמדה' },
      { id: 'pay-1', title: 'תשלום ראשון למוכר', dep: 'date', anchor: 'signing', offset: 14,
        note: 'לפי החוזה · בדרך כלל 5%–15%' },
    ],
  },
  {
    id: 'mortgage',
    title: 'המשכנתא',
    clock: 'שרשרת — לכל חוליה שעון משלה',
    items: [
      { id: 'pre-approval', title: 'אישור עקרוני', dep: 'third', anchor: 'none',
        waitingOn: 'הבנק', note: 'הריבית שהובטחה תקפה כ-24 יום בלבד' },
      { id: 'appraisal', title: 'שמאות', dep: 'third', anchor: 'none',
        waitingOn: 'השמאי', note: '3–7 ימים · משולם ישירות לשמאי' },
      { id: 'insurance', title: 'ביטוח חיים וביטוח מבנה', dep: 'you', anchor: 'none',
        note: 'מקבלן: אפשר לבקש שהפרמיה תתחיל במסירה, לא בביצוע' },
      { id: 'collateral', title: 'שלב הבטחונות', dep: 'third', anchor: 'none',
        waitingOn: 'הבנק ועורך הדין', note: '10–14 ימי עסקים' },
      { id: 'drawdown', title: 'ביצוע והעברת הכספים', dep: 'date', anchor: 'handover', offset: -30,
        note: 'לפי לוח התשלומים בחוזה' },
    ],
  },
  {
    id: 'waiting',
    title: 'תקופת ההמתנה',
    clock: 'החודשים שבהם המסך היה ריק',
    items: [
      { id: 'index', title: 'מדד תשומות הבנייה', dep: 'date', anchor: 'monthly',
        note: 'מתפרסם ב-15 בכל חודש · משנה כמה תשלמו', developerOnly: true },
      { id: 'guarantee', title: 'ערבות חוק מכר לכל תשלום', dep: 'third', anchor: 'none',
        waitingOn: 'הקבלן', note: 'לוודא שהתקבלה על כל תשלום', developerOnly: true },
      { id: 'seller-approvals', title: 'אישורי מסים ועירייה מהמוכר', dep: 'third', anchor: 'none',
        waitingOn: 'המוכר', note: 'חלק מהתמורה בנאמנות עד שיתקבלו' },
      { id: 'tenant', title: 'להתחיל לחפש שוכר', dep: 'you', anchor: 'handover', offset: -60 },
    ],
  },
  {
    id: 'handover',
    title: 'חודש המסירה',
    clock: 'נספר מיום קבלת המפתח',
    items: [
      { id: 'inspection', title: 'להזמין בדק בית', dep: 'you', anchor: 'handover', offset: -14,
        note: 'הקבלן לא יקצה שעתיים לבדיקה — מזמינים מראש' },
      { id: 'protocol', title: 'פרוטוקול מסירה + קריאת מונים', dep: 'date', anchor: 'handover', offset: 0,
        note: 'ליקויים בכתב ובצילום, ושיירשמו בפרוטוקול' },
      { id: 'pay-last', title: 'תשלום אחרון למוכר', dep: 'date', anchor: 'handover', offset: 0,
        note: 'בדרך כלל 15%–20% — התשלום הגדול האחרון' },
      { id: 'utilities', title: 'חשמל, מים, ארנונה וועד על שמך', dep: 'you', anchor: 'handover', offset: 3 },
    ],
  },
  {
    id: 'after',
    title: 'אחרי המסירה',
    clock: 'קיים, ואין לו זכר באפליקציה',
    items: [
      { id: 'defects', title: 'להודיע לקבלן על ליקויים', dep: 'date', anchor: 'handover', offset: 365,
        note: 'שנת הבדק — אחריה הזכות נחלשת', developerOnly: true },
      { id: 'registration', title: 'רישום בית משותף ורישום בטאבו', dep: 'third', anchor: 'none',
        waitingOn: 'עורך הדין' },
    ],
  },
]

/** The date an item lands on, or null when it has no clock of its own. */
export function itemDate(item: ProcessItem, signing: string, handover: string): string | null {
  if (item.anchor === 'none' || item.anchor === 'monthly' || item.offset == null) return null
  const d = parseLocalISO(item.anchor === 'signing' ? signing : handover)
  d.setDate(d.getDate() + item.offset)
  return monthDayISO(d)
}

export const DEP_LABEL: Record<Dependency, string> = {
  date: 'תלוי תאריך',
  you: 'תלוי בך',
  third: 'ממתין לאחרים',
}
