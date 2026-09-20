import type { Fixture } from './stub'

/**
 * The accounts the render specs describe, in one place: one flat, one owner, and the
 * two stages the app actually has (before the key, and from the key onwards).
 *
 * Extracted so a new spec can say "a buyer seven months out" without re-typing twenty
 * rows — and so a change to the shape of the data updates every screenshot at once.
 */
export const OWNER = '00000000-0000-0000-0000-0000000000aa'
export const PROPERTY = 'p1'

/** `YYYY-MM-DD` this many days from today, in LOCAL time (never toISOString). */
export function d(days: number): string {
  const x = new Date()
  x.setDate(x.getDate() + days)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const monthDay = (day: number) => `${d(0).slice(0, 8)}${String(day).padStart(2, '0')}`

/** The flat, financed, with the key arriving in `keyInDays` (negative = already held). */
export function base(keyInDays: number): Fixture {
  return {
    owners: [{ id: OWNER, name: 'איתי בדיקה' }],
    properties: [{
      id: PROPERTY, owner_id: OWNER, address: 'הרצל 45, תל אביב', purchase_price: 1_850_000,
      // Signing always precedes handover — with a flat -60 the leased fixture claimed a
      // key handed over a year BEFORE the contract was signed, which the app rendered
      // without blinking (and which is now blocked in the form).
      purchase_date: d(Math.min(-60, keyInDays - 240)), key_delivery_date: d(keyInDays), property_size_sqm: 68,
      floor: 4, rooms: 3, estimated_value: 1_950_000, buyer_name: 'איתי בדיקה',
      notes: null, block_parcel: null, created_at: d(-60),
    }],
    mortgages: [{ id: 'm1', property_id: PROPERTY, lender: 'בנק לאומי', payment_day: null }],
    mortgage_tracks: [
      { id: 't1', mortgage_id: 'm1', owner_id: OWNER, label: 'פריים', track_type: 'prime',
        principal: 600_000, annual_rate: 5.5, prime_rate: 6, margin: -0.5,
        term_months: 240, grace_months: 0, start_date: d(keyInDays) },
      { id: 't2', mortgage_id: 'm1', owner_id: OWNER, label: 'קל״צ', track_type: 'fixed_unlinked',
        principal: 550_000, annual_rate: 4.2, prime_rate: null, margin: null,
        term_months: 300, grace_months: 0, start_date: d(keyInDays) },
    ],
    investment_costs: [
      { id: 'c1', owner_id: OWNER, category: 'self_equity', amount: 700_000, label: null },
      { id: 'c2', owner_id: OWNER, category: 'lawyer', amount: 12_000, label: null },
      { id: 'c3', owner_id: OWNER, category: 'brokerage', amount: 39_000, label: null },
    ],
    contracts: [], loans: [], insurance_policies: [], transactions: [],
    recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
  }
}

/** The ordinary account: keys long held, a tenant in place, the monthly cycle running. */
export function leased(opts: { rentPaid?: boolean; tasks?: unknown[]; renewalSoon?: boolean } = {}): Fixture {
  const f = base(-400)
  f.contracts = [{
    id: 'ct1', owner_id: OWNER, property_id: PROPERTY, company_name: 'דנה לוי',
    start_date: d(-300), end_date: opts.renewalSoon ? d(25) : d(120),
    monthly_rent: 5_200, deposit: 5_200, payment_method: 'check',
    requires_approval: true, renewal_alert_days: [60, 30], contact_name: null,
    contact_phone: null, created_at: d(-300),
  }]
  f.recurring_items = [{
    id: 'r1', owner_id: OWNER, contract_id: 'ct1', direction: 'income', amount: 5_200,
    category: 'שכר דירה', day_of_month: 5, start_date: d(-300), end_date: d(120),
    payee: 'דנה לוי', execution_type: 'requires_approval', payment_method: 'check',
    renewal_alert_days: [60, 30],
  }]
  f.insurance_policies = [{
    id: 'i1', owner_id: OWNER, property_id: PROPERTY, type: 'מבנה', company: 'הראל',
    monthly_premium: 95, start_date: d(-300), end_date: d(65),
  }]
  if (opts.rentPaid) {
    f.transactions = [{
      id: 'x1', owner_id: OWNER, direction: 'income', amount: 5_200, date: monthDay(5),
      category: 'שכר דירה', description: 'דנה לוי', payment_method: 'check',
      recurring_item_id: 'r1',
    }]
  }
  f.tasks = opts.tasks ?? []
  return f
}

export const task = (id: string, title: string, due: string | null, category = 'כללי') => ({
  id, owner_id: OWNER, property_id: PROPERTY, title, due_date: due, due_time: null, category,
  status: 'open', source: 'manual', is_recurring: false, recurring_item_id: null,
  transaction_id: null, recurrence_days: null,
})
