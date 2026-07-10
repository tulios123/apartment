import { describe, it, expect } from 'vitest'
import { toMonthly, displayAmount, type PremiumFreq } from '../premium'

// Reproduces the unit-toggle flow of the insurance form: `exactMonthly` is the
// source of truth, `displayAmount` renders the input for the active unit.
function roundTrip(entered: number, enterUnit: PremiumFreq, toggles: PremiumFreq[]) {
  const exactMonthly = toMonthly(entered, enterUnit)
  return toggles.map(u => displayAmount(exactMonthly, u))
}

describe('premium unit conversion', () => {
  it('keeps a yearly premium stable across monthly↔yearly toggles', () => {
    // Bug #26: 1000/yr used to drift to 996 after yearly → monthly → yearly.
    const exactMonthly = toMonthly(1000, 'yearly')
    expect(displayAmount(exactMonthly, 'monthly')).toBe(83) // rounded for display
    expect(displayAmount(exactMonthly, 'yearly')).toBe(1000) // no drift
  })

  it('does not drift no matter how many times the unit is flipped', () => {
    const [a, b, c, d] = roundTrip(1000, 'yearly', ['yearly', 'monthly', 'yearly', 'monthly'])
    expect(a).toBe(1000)
    expect(b).toBe(83)
    expect(c).toBe(1000)
    expect(d).toBe(83)
  })

  it('is lossless for a monthly entry too', () => {
    const exactMonthly = toMonthly(85, 'monthly')
    expect(displayAmount(exactMonthly, 'monthly')).toBe(85)
    expect(displayAmount(exactMonthly, 'yearly')).toBe(1020)
  })

  it('stores the rounded monthly the DB expects', () => {
    expect(Math.round(toMonthly(1000, 'yearly'))).toBe(83)
    expect(Math.round(toMonthly(1200, 'yearly'))).toBe(100)
  })
})
