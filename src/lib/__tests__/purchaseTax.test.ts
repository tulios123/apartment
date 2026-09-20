import { describe, it, expect } from 'vitest'
import { purchaseTax, taxBreakdown } from '../purchaseTax'

describe('purchaseTax — דירה יחידה', () => {
  it('is zero below the exempt bracket', () => {
    expect(purchaseTax(1_090_000, true)).toBe(0)   // the owner's own deal
    expect(purchaseTax(1_850_000, true)).toBe(0)
    expect(purchaseTax(1_978_745, true)).toBe(0)   // exactly on the line
  })

  it('taxes only the slice above the line, not the whole price', () => {
    // 21,255 over the first bracket at 3.5%
    expect(purchaseTax(2_000_000, true)).toBe(Math.round(21_255 * 0.035))
  })

  it('walks the ladder for a higher price', () => {
    const price = 3_000_000
    const expected = (2_347_040 - 1_978_745) * 0.035 + (price - 2_347_040) * 0.05
    expect(purchaseTax(price, true)).toBe(Math.round(expected))
  })
})

describe('purchaseTax — דירה נוספת', () => {
  it('pays 8% from the first shekel — no exempt bracket', () => {
    expect(purchaseTax(1_090_000, false)).toBe(87_200)
    expect(purchaseTax(1_850_000, false)).toBe(148_000)
  })

  it('is 10% only above the top threshold', () => {
    const price = 7_000_000
    const expected = 6_055_070 * 0.08 + (price - 6_055_070) * 0.10
    expect(purchaseTax(price, false)).toBe(Math.round(expected))
  })

  it('is the single biggest difference between the two answers', () => {
    // The whole reason the app asks the question: same flat, 87,200 ₪ apart.
    expect(purchaseTax(1_090_000, false) - purchaseTax(1_090_000, true)).toBe(87_200)
  })
})

describe('edge cases', () => {
  it('no price → no tax, and no crash', () => {
    expect(purchaseTax(0, true)).toBe(0)
    expect(purchaseTax(-5, false)).toBe(0)
    expect(taxBreakdown(0, true)).toEqual([])
  })

  it('the breakdown sums to the tax', () => {
    for (const price of [1_090_000, 2_500_000, 7_000_000]) {
      for (const single of [true, false]) {
        const sum = taxBreakdown(price, single).reduce((s, r) => s + r.amount, 0)
        expect(Math.abs(sum - purchaseTax(price, single))).toBeLessThanOrEqual(2)
      }
    }
  })
})
