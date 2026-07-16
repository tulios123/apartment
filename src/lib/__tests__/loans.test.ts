import { describe, it, expect } from 'vitest'
import type { Loan } from '../../types'
import { monthlyPayment } from '../mortgage'
import {
  loanMonthlyPayment, loanBalance, loanInterestToDate, loanPaymentForMonth,
  loanSplitForMonth, loanTotalInterest, monthsElapsed, monthsRemaining, loanEndDate,
} from '../loans'

function loan(p: Partial<Loan>): Loan {
  return {
    repayment_type: 'monthly_fixed', principal: 0, annual_rate: 0, term_months: 0,
    grace_months: 0, start_date: '2026-01-01', ...p,
  } as unknown as Loan
}

describe('loanMonthlyPayment', () => {
  it('monthly_fixed mirrors the Shpitzer payment; balloon pays nothing', () => {
    const l = loan({ principal: 50000, annual_rate: 4, term_months: 60 })
    expect(loanMonthlyPayment(l)).toBeCloseTo(monthlyPayment(50000, 4, 60), 6)
    expect(loanMonthlyPayment(loan({ repayment_type: 'balloon', principal: 50000 }))).toBe(0)
  })
})

describe('loanBalance', () => {
  it('balloon stays at full principal regardless of date', () => {
    const b = loan({ repayment_type: 'balloon', principal: 80000 })
    expect(loanBalance(b, new Date(2030, 0, 1))).toBe(80000)
  })
  it('monthly_fixed amortizes to ~0 by the end of term', () => {
    const l = loan({ principal: 120000, annual_rate: 5, term_months: 12 })
    expect(loanBalance(l, new Date(2028, 0, 1))).toBeCloseTo(0, 2)
  })
  it('as-of a payment date does NOT depend on the time of day (no UTC roll-back)', () => {
    const l = loan({ principal: 120000, annual_rate: 5, term_months: 12, start_date: '2026-01-01' })
    const midnight = loanBalance(l, new Date(2026, 5, 1, 0, 0))   // local 2026-06-01 00:00
    const noon = loanBalance(l, new Date(2026, 5, 1, 12, 0))      // local 2026-06-01 12:00
    expect(midnight).toBeCloseTo(noon, 6)
  })
})

describe('loan schedule — first payment in the start month + billing day', () => {
  it('dates the first payment in the start month, and payment_day sets the day', () => {
    const l = loan({ principal: 60000, annual_rate: 5, term_months: 6, start_date: '2026-03-01', payment_day: 10 })
    // March start → March payment, on the 10th.
    expect(loanPaymentForMonth(l, '2026-03')?.date).toBe('2026-03-10')
    expect(loanPaymentForMonth(l, '2026-04')?.date).toBe('2026-04-10')
  })
})

describe('loan schedule — a day-31 start still has a February payment', () => {
  it('Feb and March each have exactly one payment (no setMonth overflow)', () => {
    const l = loan({ principal: 60000, annual_rate: 5, term_months: 6, start_date: '2026-01-31' })
    expect(loanPaymentForMonth(l, '2026-02')).not.toBeNull()
    expect(loanPaymentForMonth(l, '2026-03')).not.toBeNull()
    // The Feb payment date is clamped to the 28th, not overflowed into March.
    expect(loanPaymentForMonth(l, '2026-02')?.date).toBe('2026-02-28')
  })
})

describe('loanInterestToDate', () => {
  it('as-of a payment date does NOT depend on the time of day (no UTC roll-back)', () => {
    const l = loan({ principal: 120000, annual_rate: 5, term_months: 12, start_date: '2026-01-01' })
    const midnight = loanInterestToDate(l, new Date(2026, 5, 1, 0, 0))
    const noon = loanInterestToDate(l, new Date(2026, 5, 1, 12, 0))
    expect(midnight).toBeCloseTo(noon, 6)
  })
})

describe('loanPaymentForMonth / loanSplitForMonth', () => {
  const l = loan({ principal: 120000, annual_rate: 5, term_months: 12, start_date: '2026-01-01' })
  it('returns the scheduled payment for a month in the schedule', () => {
    const p = loanPaymentForMonth(l, '2026-06')
    expect(p).not.toBeNull()
    expect(p!.date).toBe('2026-06-01')
    expect(p!.amount).toBeGreaterThan(0)
  })
  it('split principal+interest sums to the payment', () => {
    const p = loanPaymentForMonth(l, '2026-06')!
    const s = loanSplitForMonth(l, '2026-06')!
    expect(s.principal + s.interest).toBeCloseTo(p.amount, 6)
  })
  it('null for balloon and for months outside the schedule', () => {
    expect(loanPaymentForMonth(loan({ repayment_type: 'balloon', principal: 1 }), '2026-06')).toBeNull()
    expect(loanPaymentForMonth(l, '2030-01')).toBeNull()
  })
})

describe('helpers', () => {
  it('loanTotalInterest is positive for a rate-bearing loan', () => {
    expect(loanTotalInterest(loan({ principal: 100000, annual_rate: 6, term_months: 60 }))).toBeGreaterThan(0)
  })
  it('monthsElapsed counts whole months from start (0 before start)', () => {
    expect(monthsElapsed('2026-01-01', new Date(2026, 5, 15))).toBe(5)
    expect(monthsElapsed('2026-01-01', new Date(2025, 0, 1))).toBe(0)
    expect(monthsElapsed(null)).toBe(0)
  })
  it('monthsRemaining = term − elapsed (0 for balloon)', () => {
    const l = loan({ term_months: 12, start_date: '2026-01-01' })
    expect(monthsRemaining(l, new Date(2026, 5, 15))).toBe(7)
    expect(monthsRemaining(loan({ repayment_type: 'balloon' }), new Date(2026, 5, 15))).toBe(0)
  })
  it('loanEndDate = the last payment month (start + term − 1, null for balloon)', () => {
    // First payment now falls in the start month, so 12 payments span Jan–Dec 2026.
    expect(loanEndDate(loan({ term_months: 12, start_date: '2026-01-01' }))).toBe('2026-12-01')
    expect(loanEndDate(loan({ repayment_type: 'balloon' }))).toBeNull()
  })
})
