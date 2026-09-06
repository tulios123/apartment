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
  contract_id?: string | null
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
 * Anything that reminderLine() will word as a rent-check deposit. That wording keys off
 * income + payment_method alone, while the silencing rule used to require a rent
 * CATEGORY — so an income-by-check item filed under any other category produced a
 * "deposit the rent cheque" nag that no amount of recording could ever silence.
 * Both sides now ask the same question (owner, 28.07).
 */
export function isRentLike(item: { direction: string; category: string; payment_method?: string | null }): boolean {
  return isRentIncome(item) || (item.direction === 'income' && item.payment_method === 'check')
}

/**
 * The day of the month an approval item actually becomes actionable.
 *
 * For rent paid by post-dated cheque this is the date written on the cheque: before it
 * the cheque cannot be deposited, so "deposit the cheque" from the 1st of the month is
 * pure noise — which is what every owner was getting, because rent items were created
 * with day_of_month = 1 and nothing ever updated it (owner, 06.09).
 *
 * Resolution order, deliberately never moving a reminder EARLIER than it fires today:
 *  1. the item's own day_of_month when it isn't the untouched default of 1,
 *  2. the contract's start day — a lease starting on the 15th is paid on the 15th.
 * Mirrors rentPaymentDay in src/lib/rent.ts (edge functions can't import from src/).
 */
export function dueDayOfMonth(
  item: { day_of_month: number; contract_id?: string | null },
  contract?: { start_date?: string | null } | null,
): number {
  if (item.day_of_month > 1) return Math.min(28, item.day_of_month)
  const startDay = Number(contract?.start_date?.slice(8, 10))
  if (Number.isFinite(startDay) && startDay >= 1) return Math.min(28, startDay)
  return item.day_of_month
}

/**
 * Is this owner still waiting to take possession — i.e. every property they own has a
 * key-delivery date that hasn't arrived yet?
 *
 * The "no active lease — add a tenant" nudge repeats fortnightly for anyone who owns a
 * property and has no live contract. For a buyer whose key delivery is still ahead that
 * is a recommendation to let an apartment they may not even enter: eight months of
 * waiting is ~17 pushes about the one thing they cannot do (owner, 06.09).
 *
 * Deliberately conservative, so nobody who can act loses the nudge: only an explicitly
 * entered, still-future date counts as waiting. A blank date, or one that has passed,
 * reads as possession — which is every existing owner, so none of them change.
 */
export function awaitingKeyDelivery(
  properties: { key_delivery_date?: string | null }[],
  todayISO: string,
): boolean {
  if (properties.length === 0) return false
  return properties.every((p) => !!p.key_delivery_date && p.key_delivery_date > todayISO)
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
    if (isRentLike(it) && rentIncomeRecorded) return false
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
