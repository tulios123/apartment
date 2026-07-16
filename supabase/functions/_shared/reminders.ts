// Pure decision logic for the daily-reminders push, split out so it can be
// unit-tested without a Supabase client or the Deno runtime.

// Mirrors src/lib/constants.ts RENT_CATEGORIES ('שכירות' kept for legacy rows).
export const RENT_CATEGORIES = ['שכר דירה', 'שכירות']

export type DueItem = {
  id: string
  direction: string
  category: string
  payee: string | null
  payment_method: string | null
}

export type MonthTx = {
  recurring_item_id: string | null
  direction: string
  category: string
}

/** A rent-collection item — the monthly "collect rent / deposit the check" approval. */
export function isRentIncome(item: { direction: string; category: string }): boolean {
  return item.direction === 'income' && RENT_CATEGORIES.includes(item.category)
}

/**
 * Which approval items still need a reminder line this month.
 * An item is "already handled" when either:
 *  - a transaction this month is linked to it (recurring_item_id), OR
 *  - it's a rent-collection item and ANY rent-category income landed this month.
 * The second rule mirrors the home screen, which marks rent received by category
 * regardless of whether the transaction was linked to the recurring item. Without
 * it, recording the deposit any way other than the home "approve" button left the
 * daily push nagging to deposit a check that was already deposited (feedback #53).
 */
export function pendingApprovalItems(dueItems: DueItem[], txThisMonth: MonthTx[]): DueItem[] {
  const linked = new Set(
    txThisMonth.filter((t) => t.recurring_item_id != null).map((t) => t.recurring_item_id),
  )
  const rentIncomeRecorded = txThisMonth.some((t) => isRentIncome(t))
  return dueItems.filter((it) => {
    if (linked.has(it.id)) return false
    if (isRentIncome(it) && rentIncomeRecorded) return false
    return true
  })
}

/** The reminder line for a due approval item. */
export function reminderLine(it: DueItem): string {
  // Post-dated-check rent → remind to DEPOSIT the check, not "collect rent".
  if (it.direction === 'income' && it.payment_method === 'check') {
    return `הפקדת צ׳ק שכר דירה${it.payee ? ` – ${it.payee}` : ''}`
  }
  const label = it.direction === 'income' ? 'גביית' : 'תשלום'
  return `${label} ${it.category}${it.payee ? ` – ${it.payee}` : ''}`
}
