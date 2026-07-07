import { describe, it, expect } from 'vitest'
import type { MortgageTrack } from '../../types'
import { monthlyPayment, trackSchedule, gracePeriodPayment, interestToDate, combineSchedules } from '../mortgage'

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
    // EDGE-12: grace ≥ term is clamped to term-1 (always ≥1 amortizing month) so it
    // never produces a never-amortizing (zero) schedule. 12-month / 12-grace → 1 month.
    const clamped = monthlyPayment(100000, 6, 12, 12)
    expect(clamped).toBeGreaterThan(0)
    expect(Number.isFinite(clamped)).toBe(true)
    // EDGE-13: a net-negative rate is floored to 0 → straight-line, never NaN.
    expect(monthlyPayment(120000, -3, 12)).toBeCloseTo(10000, 6)
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

describe('trackSchedule — a day-31 start lands exactly one row per month', () => {
  it('does not skip February or double up March (setMonth overflow)', () => {
    const t = track({ principal: 120000, annual_rate: 6, term_months: 6, start_date: '2026-01-31' })
    const months = trackSchedule(t).map(r => r.date.slice(0, 7))
    expect(months).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'])
    // The day is clamped to each month's length — Feb → 28, not overflowed into March.
    expect(trackSchedule(t)[0].date).toBe('2026-02-28')
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

describe('combineSchedules coerces a string principal in the carry-forward (numeric col → string)', () => {
  it('combined balance stays numeric and sane when tracks start in different months', () => {
    // Supabase returns principal as a string. On the newer track's start month — before
    // its first payment row — its principal is carried forward; without coercion the
    // `balance += principal` would concatenate into a 12+ digit garbage string.
    const older = track({ principal: '1000000' as unknown as number, annual_rate: 5, term_months: 240, start_date: '2020-01-01' })
    const newer = track({ principal: '500000' as unknown as number, annual_rate: 4, term_months: 240, start_date: '2024-06-01' })
    const combined = combineSchedules([older, newer])
    combined.forEach(r => {
      expect(typeof r.balance).toBe('number')
      expect(Number.isFinite(r.balance)).toBe(true)
    })
    // On the newer track's start month the full 500k is added on top of the older
    // track's outstanding balance — total must be a real ~₪1.2–1.5M, never a concat.
    const startRow = combined.find(r => r.date === '2024-06-01')
    expect(startRow).toBeDefined()
    expect(startRow!.balance).toBeGreaterThan(500000)
    expect(startRow!.balance).toBeLessThan(1600000)
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
