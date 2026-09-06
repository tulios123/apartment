import { describe, it, expect } from 'vitest'
import { rentPaymentDay, isRentPayable } from '../rent'

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

describe('isRentPayable', () => {
  it('stays quiet before the cheque date', () => {
    // Owner, 06.09: the home must not ask "was the cheque deposited?" on the 6th when
    // the cheque is dated the 10th — there is nothing to deposit yet.
    expect(isRentPayable('2026-09-06', 10)).toBe(false)
  })

  it('asks from the cheque date onward', () => {
    expect(isRentPayable('2026-09-10', 10)).toBe(true)
    expect(isRentPayable('2026-09-28', 10)).toBe(true)
  })

  it('asks all month when the rent day is the 1st', () => {
    expect(isRentPayable('2026-09-01', 1)).toBe(true)
  })
})
