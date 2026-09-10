import type { Fixture } from './stub'
import { d } from './fixtures'

/**
 * The three people the night run walks — not "a user", but someone with a deal.
 *
 * The numbers are real-shaped and internally consistent, because the whole first question
 * of the run is "does the app tell the truth", and you cannot answer that against a fixture
 * whose own arithmetic does not close. Every figure below reconciles:
 *
 *   price 1,850,000 = mortgage 1,150,000 + equity 700,000
 *   from pocket     = 462,500 (25% in two payments) + 12,000 lawyer + 39,000 broker
 *                     + purchase tax, which depends on ONE declaration
 *
 * That last line is the sharpest truth test in the app. At 1,850,000 a **single**
 * apartment pays zero purchase tax (the 2026 exemption runs to 1,978,745); an
 * **additional** apartment pays 8% — ₪148,000. One toggle, ₪148,000 of difference, and
 * the same screen has to be right either way. This app is for investment apartments, so
 * the additional-apartment persona is the default and the single one is the edge.
 */

export const OWNER = '00000000-0000-0000-0000-0000000000aa'
export const P = 'p1'

/** Persona B — signed, waiting. The stage the owner's brother and friend are actually in. */
export const B = {
  name: 'אורי',
  price: 1_850_000,
  /** Two months ago: he did not install the day he signed, and most of his dates are past. */
  signedDaysAgo: 60,
  /** Seven months out — a new-build handover, the common shape. */
  keyInDays: 217,
  firstPct: 10,
  secondPct: 15,
  singleApartment: false,
  lawyer: 12_000,
  broker: 39_000,
  equity: 700_000,
  mortgage: 1_150_000,
  /** What the app must arrive at on its own. Asserted, not trusted. */
  expect: {
    pay1: 185_000,
    pay2: 277_500,
    tax: 148_000,
    fromPocket: 185_000 + 277_500 + 12_000 + 39_000 + 148_000, // 661,500
  },
}

/**
 * The account as it stands AFTER the wizard, for the in-app walk.
 *
 * `keyInDays` is what decides the stage — the app derives it, never stores it — so the
 * same builder serves stage C by passing a negative number.
 */
export function account(keyInDays: number, signedDaysAgo = 60): Fixture {
  return {
    owners: [{ id: OWNER, name: B.name }],
    properties: [{
      id: P, owner_id: OWNER, address: 'הרצל 45, תל אביב', purchase_price: B.price,
      purchase_date: d(-signedDaysAgo), key_delivery_date: d(keyInDays),
      property_size_sqm: 68, floor: 4, rooms: 3, estimated_value: 1_950_000,
      buyer_name: B.name, notes: null, block_parcel: null, created_at: d(-signedDaysAgo),
    }],
    mortgages: [{ id: 'm1', property_id: P, lender: 'בנק לאומי', payment_day: null }],
    mortgage_tracks: [
      { id: 't1', mortgage_id: 'm1', owner_id: OWNER, label: 'פריים', track_type: 'prime',
        principal: 600_000, annual_rate: 5.5, prime_rate: 6, margin: -0.5,
        term_months: 240, grace_months: 0, start_date: d(keyInDays) },
      { id: 't2', mortgage_id: 'm1', owner_id: OWNER, label: 'קל״צ', track_type: 'fixed_unlinked',
        principal: 550_000, annual_rate: 4.2, prime_rate: null, margin: null,
        term_months: 300, grace_months: 0, start_date: d(keyInDays) },
    ],
    investment_costs: [
      { id: 'c1', owner_id: OWNER, category: 'self_equity', amount: B.equity, label: null },
      { id: 'c2', owner_id: OWNER, category: 'lawyer', amount: B.lawyer, label: null },
      { id: 'c3', owner_id: OWNER, category: 'brokerage', amount: B.broker, label: null },
    ],
    contracts: [], loans: [], insurance_policies: [], transactions: [],
    recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
  }
}

/** A brand-new account: the person exists, nothing else does. Routes into the wizard. */
export const empty: Fixture = {
  owners: [{ id: OWNER, name: B.name }],
  properties: [], mortgages: [], mortgage_tracks: [], investment_costs: [],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}
