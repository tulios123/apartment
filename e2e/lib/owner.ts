import type { Fixture } from './stub'
import { d, monthDay, OWNER, PROPERTY } from './fixtures'

/**
 * PASS 2's persona — a 22-year-old who has owned one let flat for about a year.
 *
 * The number that shapes every screen he sees is the one he did not choose: rent ₪4,000
 * against a mortgage instalment of about ₪4,600. **The flat loses money every month**,
 * by design, and he is opening the app to find out whether that is expected or whether
 * something has gone wrong. An app that answers "הכול רגוע" to that question has not
 * answered it.
 *
 *   price 1,090,000 · mortgage 817,500 @ 4.6% over 25 years ⇒ ~4,591/mo
 *   rent 4,000 · insurance 110 · so a normal month is roughly −700 before anything breaks
 *
 * The account carries real history, because the whole point of this pass is the collision
 * the fresh-deal walks could not stage: a REAL rent transaction sitting in the same month
 * as the forecast row it is supposed to replace.
 */

const RENT = 4_000

/** A rent receipt for the month `back` months ago, on the 5th. */
function rentTx(id: string, back: number) {
  const x = new Date()
  x.setDate(1)
  x.setMonth(x.getMonth() - back)
  const ym = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
  return {
    id, owner_id: OWNER, direction: 'income', amount: RENT, date: `${ym}-05`,
    category: 'שכר דירה', description: 'יובל אברהם', payment_method: 'transfer',
    recurring_item_id: 'r1',
  }
}

/**
 * @param opts.rentThisMonth  the current month rent already received — the override case.
 * @param opts.leaseEndsInDays  how far off the renewal is.
 */
export function owner(opts: { rentThisMonth?: boolean; leaseEndsInDays?: number } = {}): Fixture {
  const keyDays = -380          // keys about thirteen months ago
  const leaseStart = d(-330)
  const leaseEnd = d(opts.leaseEndsInDays ?? 120)

  const transactions = [
    // Three months of history, so the ledger is not empty and the yearly view has shape.
    rentTx('x1', 3), rentTx('x2', 2), rentTx('x3', 1),
    // Real expenses he entered himself.
    { id: 'x4', owner_id: OWNER, direction: 'expense', amount: 1_450, date: d(-52),
      category: 'תיקונים ותחזוקה', description: 'החלפת דוד שמש', payment_method: 'transfer', recurring_item_id: null },
    { id: 'x5', owner_id: OWNER, direction: 'expense', amount: 260, date: d(-24),
      category: 'ועד בית', description: 'ועד רבעוני', payment_method: 'transfer', recurring_item_id: null },
  ]
  if (opts.rentThisMonth !== false) transactions.push(rentTx('x6', 0))

  return {
    owners: [{ id: OWNER, name: 'רון' }],
    properties: [{
      id: PROPERTY, owner_id: OWNER, address: 'ויצמן 12, פתח תקווה', purchase_price: 1_090_000,
      purchase_date: d(-470), key_delivery_date: d(keyDays), property_size_sqm: 52,
      floor: 2, rooms: 2.5, estimated_value: 1_180_000, buyer_name: 'רון',
      notes: null, block_parcel: null, created_at: d(-470),
    }],
    mortgages: [{ id: 'm1', property_id: PROPERTY, lender: 'בנק הפועלים', payment_day: 10 }],
    mortgage_tracks: [
      { id: 't1', mortgage_id: 'm1', owner_id: OWNER, label: null, track_type: 'fixed_unlinked',
        principal: 817_500, annual_rate: 4.6, prime_rate: null, margin: null,
        term_months: 300, grace_months: 0, start_date: d(keyDays) },
    ],
    investment_costs: [
      { id: 'c1', owner_id: OWNER, category: 'self_equity', amount: 272_500, label: null },
      { id: 'c2', owner_id: OWNER, category: 'lawyer', amount: 8_000, label: null },
    ],
    contracts: [{
      id: 'ct1', owner_id: OWNER, property_id: PROPERTY, company_name: 'יובל אברהם',
      start_date: leaseStart, end_date: leaseEnd, monthly_rent: RENT, deposit: RENT,
      payment_method: 'transfer', requires_approval: true, renewal_alert_days: [60, 30],
      contact_name: null, contact_phone: null, created_at: leaseStart,
    }],
    loans: [],
    insurance_policies: [{
      id: 'i1', owner_id: OWNER, property_id: PROPERTY, type: 'מבנה', company: 'הראל',
      monthly_premium: 110, start_date: leaseStart, end_date: d(200),
    }],
    transactions,
    recurring_items: [{
      id: 'r1', owner_id: OWNER, contract_id: 'ct1', direction: 'income', amount: RENT,
      category: 'שכר דירה', day_of_month: 5, start_date: leaseStart, end_date: leaseEnd,
      payee: 'יובל אברהם', execution_type: 'requires_approval', payment_method: 'transfer',
      renewal_alert_days: [60, 30],
    }],
    tasks: [
      // One behind him, one ahead — the brief asks for both.
      { id: 'k1', owner_id: OWNER, property_id: PROPERTY, title: 'לחדש את פוליסת המבנה',
        due_date: d(-40), due_time: null, category: 'כללי', status: 'done', source: 'manual',
        is_recurring: false, recurring_item_id: null, transaction_id: null, recurrence_days: null },
      { id: 'k2', owner_id: OWNER, property_id: PROPERTY, title: 'בדיקת רטיבות בחדר האמבטיה',
        due_date: d(6), due_time: null, category: 'תיקונים ותחזוקה', status: 'open', source: 'manual',
        is_recurring: false, recurring_item_id: null, transaction_id: null, recurrence_days: null },
    ],
    documents: [], push_subscriptions: [],
  }
}

export { monthDay }
