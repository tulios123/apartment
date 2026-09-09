import { describe, it, expect } from 'vitest'
import { addMonths, scenarioData, SCENARIOS } from '../scenarios'
import { monthlyVirtualEntries } from '../projections'
import { daysBetween, parseLocalISO } from '../format'
import type { MortgageTrack } from '../../types'
import { possession, leaseStatus } from '../stage'

const today = '2026-09-07'

describe('addMonths', () => {
  it('shifts whole months in both directions', () => {
    expect(addMonths('2026-09-07', 7)).toBe('2027-04-07')
    expect(addMonths('2026-09-07', -2)).toBe('2026-07-07')
  })

  it('clamps into the target month instead of spilling over', () => {
    // 31 Jan + 1 month is 28 Feb, not 3 March.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })
})

// The point of the loader: the app must derive the stage from the seeded rows exactly as
// it will for a real account. If a scenario didn't produce its own stage, the button
// would be testing a fiction.
describe('each scenario derives the stage it claims', () => {
  it('purchase_process reads as awaiting the key, with no lease', () => {
    const d = scenarioData('purchase_process', today)
    expect(possession(d.property.key_delivery_date as string, today)).toBe('awaiting_key')
    expect(d.contract).toBeNull()
    expect(leaseStatus([], today)).toBe('none')
  })

  it('keys_no_tenant reads as in hand, with no lease', () => {
    const d = scenarioData('keys_no_tenant', today)
    expect(possession(d.property.key_delivery_date as string, today)).toBe('in_hand')
    expect(d.contract).toBeNull()
  })

  it('leased reads as in hand, with a lease covering today', () => {
    const d = scenarioData('leased', today)
    expect(possession(d.property.key_delivery_date as string, today)).toBe('in_hand')
    const c = d.contract as { start_date: string; end_date: string }
    expect(leaseStatus([c], today)).toBe('leased')
  })
})

describe('scenario shape', () => {
  it('starts the mortgage at handover, so nothing is charged before the flat exists', () => {
    const d = scenarioData('purchase_process', today)
    for (const t of d.tracks) {
      expect(t.start_date).toBe(d.property.key_delivery_date)
    }
  })

  it('keeps one flat across all three, so only the stage differs', () => {
    const ids = SCENARIOS.map((s) => s.id)
    const addresses = ids.map((id) => scenarioData(id, today).property.address)
    expect(new Set(addresses).size).toBe(1)
  })

  it('gives the leased scenario a rent item matching its contract', () => {
    const d = scenarioData('leased', today)
    const c = d.contract as { start_date: string; monthly_rent: number }
    const item = d.rentItem as { amount: number; day_of_month: number; contract_id?: string }
    expect(item.amount).toBe(c.monthly_rent)
    expect(item.day_of_month).toBe(Number(c.start_date.slice(8, 10)))
  })

  it('leaves the other two scenarios without a rent item', () => {
    expect(scenarioData('purchase_process', today).rentItem).toBeNull()
    expect(scenarioData('keys_no_tenant', today).rentItem).toBeNull()
  })
})

// The pre-key card's whole claim is that it says something true where the month card
// said ₪0. Prove its inputs are real numbers on the seeded account, using the same
// engine the card and the ledger both call.
describe('the pre-key card has something to say', () => {
  it('has capital already in, and a real first monthly payment', () => {
    const d = scenarioData('purchase_process', today)
    const keyDate = d.property.key_delivery_date as string

    const invested = d.costs.reduce((s, c) => s + (c.amount as number), 0)
    expect(invested).toBe(751_000)

    const kd = parseLocalISO(keyDate)
    const firstMonth = monthlyVirtualEntries(
      [], d.tracks as unknown as MortgageTrack[], kd.getFullYear(), kd.getMonth() + 1,
    ).filter(e => e.direction === 'expense')
    const firstPayment = firstMonth.reduce((s, e) => s + e.amount, 0)

    // Two Spitzer tracks (600k @ 5.5%/240mo + 550k @ 4.2%/300mo) — a five-figure payment,
    // not a zero and not a NaN.
    expect(firstPayment).toBeGreaterThan(6_000)
    expect(Number.isFinite(firstPayment)).toBe(true)
  })

  it('shows nothing owed before handover — which is why the month card read ₪0', () => {
    const d = scenarioData('purchase_process', today)
    const [y, m] = today.split('-').map(Number)
    const thisMonth = monthlyVirtualEntries([], d.tracks as unknown as MortgageTrack[], y, m)
    expect(thisMonth).toHaveLength(0)
  })
})

describe('the near-handover scenario', () => {
  it('is still awaiting the key, just barely', () => {
    const d = scenarioData('handover_soon', today)
    expect(possession(d.property.key_delivery_date as string, today)).toBe('awaiting_key')
    expect(d.contract).toBeNull()
  })

  it('is the crowded end of the checklist — most of it lands at once', () => {
    // Worth being able to look at: with handover two weeks out, every anchor further
    // back than that collapses onto today. This is the case where the list is densest,
    // and the one to judge the "don't overwhelm" rule against.
    const d = scenarioData('handover_soon', today)
    // The seeded task list this used to assert against is gone (superseded by the payment
    // plan, docs/specs/purchase-stage.md). What still matters about this scenario is that it
    // really is the tight one: a handover close enough to crowd the map.
    expect(daysBetween(today, d.property.key_delivery_date as string)).toBeLessThanOrEqual(21)
  })
})

describe('the handover moment is reachable from a scenario', () => {
  it('hands the keys over yesterday, inside the greeting window', () => {
    const d = scenarioData('keys_no_tenant', today)
    const keyDate = d.property.key_delivery_date as string
    expect(possession(keyDate, today)).toBe('in_hand')
    // 0..14 days after handover is when the greeting is offered (HandoverMoment).
    expect(daysBetween(keyDate, today)).toBe(1)
    expect(d.contract).toBeNull()
  })

  it('leaves the leased scenario outside that window, so it stays the ordinary state', () => {
    const d = scenarioData('leased', today)
    expect(daysBetween(d.property.key_delivery_date as string, today)).toBeGreaterThan(14)
  })
})
