import { describe, it, expect } from 'vitest'
import { addMonths, scenarioData, SCENARIOS } from '../scenarios'
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
