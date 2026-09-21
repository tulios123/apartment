import type { DocumentType } from '../types'

/**
 * The one list of documents the app expects an owner to have.
 *
 * There used to be two. The wizard asked for a purchase contract, a mortgage approval, a
 * loan document, a lease and an insurance policy; the Documents screen asked for a נסח טאבו,
 * a purchase contract, and then some of the rest depending on what the account contained.
 * So the wizard could be walked to completion and the Documents screen would still open
 * saying something was missing — a document it had never once mentioned (Omer, note 14).
 *
 * The owner's decision (21.09): one list, נסח טאבו included, and the same idea everywhere —
 * we say which documents we think apply to you and which we already have. Nothing in the
 * wizard is required; the list is what we expect, not a gate.
 */

/** What the app knows about the account, insofar as it decides which documents apply. */
export interface ChecklistContext {
  hasLease: boolean
  hasMortgage: boolean
  hasLoan: boolean
}

export interface ChecklistSlot {
  type: DocumentType
  label: string
  /** Why we are asking — shown when the slot is still empty. */
  hint: string
  /** False when the slot is only expected because the account has that thing. */
  universal: boolean
}

const ALL: (ChecklistSlot & { applies: (c: ChecklistContext) => boolean })[] = [
  {
    type: 'purchase_contract', label: 'חוזה רכישה', universal: true,
    hint: 'מחיר, תאריכים וצדדים',
    applies: () => true,
  },
  {
    type: 'tabu_extract', label: 'נסח טאבו', universal: true,
    // Asked on the Documents screen since day one and never in the wizard, which is why
    // a freshly-finished account opened the screen at 0/1 on a document nobody mentioned.
    hint: 'אישור הבעלות מהטאבו',
    applies: () => true,
  },
  {
    type: 'mortgage_statement', label: 'אישור משכנתא', universal: false,
    hint: 'דף התנאים מהבנק',
    applies: c => c.hasMortgage,
  },
  {
    type: 'loan_statement', label: 'הלוואה', universal: false,
    hint: 'מסמך ההלוואה המשלימה',
    applies: c => c.hasLoan,
  },
  {
    type: 'rental_contract', label: 'חוזה שכירות', universal: false,
    hint: 'החוזה מול הדייר',
    applies: c => c.hasLease,
  },
  {
    type: 'insurance_policy', label: 'פוליסת ביטוח', universal: true,
    hint: 'ביטוח מבנה או משכנתא',
    applies: () => true,
  },
]

/**
 * The slots that apply to this account, in the order both screens show them.
 *
 * In the wizard nothing is known yet, so `wizard` mode returns everything: there we are
 * offering a place to put each document, not claiming one is missing.
 */
export function checklistSlots(ctx: ChecklistContext | 'wizard'): ChecklistSlot[] {
  if (ctx === 'wizard') return ALL.map(({ applies: _applies, ...s }) => s)
  return ALL.filter(s => s.applies(ctx)).map(({ applies: _applies, ...s }) => s)
}
