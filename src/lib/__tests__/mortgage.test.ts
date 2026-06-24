import { describe, it, expect } from 'vitest'
import type { MortgageTrack } from '../../types'
import { monthlyPayment, trackSchedule, gracePeriodPayment, interestToDate } from '../mortgage'

// Minimal track factory — the math only reads these five fields.
function track(p: Partial<MortgageTrack>): MortgageTrack {
  return { principal: 0, annual_rate: 0, term_months: 0, start_date: '2026-01-01', grace_months: 0, ...p } as unknown as MortgageTrack
}

const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0)

describe('monthlyPayment (Shpitzer annuity)', () => {
  it('matches a known annuity (100k, 6%, 120mo ≈ 1110.21)', () => {
    const p = monthlyPayment(100000, 6, 120)
    expect(p).toBeGreaterThan(1110)
    expect(p).toBeLessThan(1111)
  })
  it('0% rate → straight-line principal / term', () => {
    expect(monthlyPayment(120000, 0, 12)).toBeCloseTo(10000, 6)
  })
  it('grace shortens the amortizing term', () => {
    // Same principal amortized over fewer months → higher payment.
    expect(monthlyPayment(100000, 6, 120, 12)).toBeGreaterThan(monthlyPayment(100000, 6, 120, 0))
  })
  it('guards degenerate inputs (no NaN/Infinity)', () => {
    expect(monthlyPayment(0, 6, 120)).toBe(0)
    expect(monthlyPayment(100000, 6, 0)).toBe(0)
    expect(monthlyPayment(100000, 6, 12, 12)).toBe(0) // grace == term → effectiveTerm 0
  })
})

describe('trackSchedule', () => {
  it('amortizes to zero with principal summing to the loan', () => {
    const t = track({ principal: 100000, annual_rate: 6, term_months: 60 })
    const rows = trackSchedule(t)
    expect(rows).toHaveLength(60)
    expect(rows[rows.length - 1].balance).toBeCloseTo(0, 4)
    expect(sum(rows.map(r => r.principal))).toBeCloseTo(100000, 2)
    // Each payment = interest + principal.
    rows.forEach(r => expect(r.payment).toBeCloseTo(r.interest + r.principal, 6))
  })
  it('0% rate → equal principal each month, no interest', () => {
    const rows = trackSchedule(track({ principal: 12000, annual_rate: 0, term_months: 12 }))
    rows.forEach(r => { expect(r.interest).toBe(0); expect(r.principal).toBeCloseTo(1000, 6) })
  })
  it('grace months are interest-only (no principal, balance held)', () => {
    const t = track({ principal: 100000, annual_rate: 6, term_months: 12, grace_months: 3 })
    const rows = trackSchedule(t)
    for (let i = 0; i < 3; i++) {
      expect(rows[i].principal).toBe(0)
      expect(rows[i].payment).toBeCloseTo(rows[i].interest, 6)
      expect(rows[i].balance).toBeCloseTo(100000, 6) // unchanged during grace
    }
    expect(rows[rows.length - 1].balance).toBeCloseTo(0, 4) // still pays off by term
    expect(sum(rows.map(r => r.principal))).toBeCloseTo(100000, 2)
  })
})

describe('gracePeriodPayment', () => {
  it('returns 0 when no track has grace', () => {
    expect(gracePeriodPayment([track({ principal: 100000, annual_rate: 6, term_months: 120 })])).toBe(0)
  })
  it('grace track pays interest-only; non-grace track pays full Shpitzer', () => {
    const g = track({ principal: 100000, annual_rate: 6, term_months: 120, grace_months: 12 })
    const n = track({ principal: 50000, annual_rate: 4, term_months: 60 })
    const expected = 100000 * (6 / 100 / 12) + monthlyPayment(50000, 4, 60)
    expect(gracePeriodPayment([g, n])).toBeCloseTo(expected, 6)
  })
})

describe('interestToDate uses LOCAL dates (no UTC roll-back)', () => {
  it('includes a payment row dated exactly on the asOf local date', () => {
    // Rows fall on the 1st of each month; asOf = local midnight on a payment date.
    // A UTC-derived cutoff (toISOString) lands on the previous day in Israel and
    // would wrongly drop that row.
    const t = track({ principal: 120000, annual_rate: 5, term_months: 12, start_date: '2026-01-01' })
    const rows = trackSchedule(t)
    const asOf = new Date(2026, 5, 1) // local 2026-06-01 — row #5 is dated 2026-06-01
    const localCutoff = '2026-06-01'
    const expected = sum(rows.filter(r => r.date <= localCutoff).map(r => r.interest))
    expect(interestToDate([t], asOf)).toBeCloseTo(expected, 6)
  })
})
