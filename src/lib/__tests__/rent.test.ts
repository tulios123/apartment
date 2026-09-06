import { describe, it, expect } from 'vitest'
import { rentPaymentDay } from '../rent'

describe('rentPaymentDay', () => {
  it('uses the cheque day stored on the rent item', () => {
    expect(rentPaymentDay({ dayOfMonth: 10, startDate: '2026-03-01' })).toBe(10)
  })

  it('falls back to the lease start day instead of the 1st', () => {
    // Every rent item created before 06.09 sits on the default day_of_month = 1, which
    // is why the "deposit the cheque" reminder fired from the 1st of the month.
    expect(rentPaymentDay({ dayOfMonth: 1, startDate: '2026-03-15' })).toBe(15)
    expect(rentPaymentDay({ dayOfMonth: null, startDate: '2026-03-15' })).toBe(15)
  })

  it('clamps to 28 so the day exists in February', () => {
    expect(rentPaymentDay({ startDate: '2026-03-31' })).toBe(28)
    expect(rentPaymentDay({ dayOfMonth: 31 })).toBe(28)
  })

  it('returns the 1st when nothing is known', () => {
    expect(rentPaymentDay({})).toBe(1)
    expect(rentPaymentDay({ dayOfMonth: 1, startDate: '2026-03-01' })).toBe(1)
  })
})
