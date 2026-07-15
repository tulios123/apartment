import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Contract, MortgageTrack, Loan } from '../../types'
import {
  monthlyVirtualEntries, activeContract, mortgagePaidToDate,
  rentReceivedToDate, insurancePaidToDate, elapsedMonths,
} from '../projections'

function contract(p: Partial<Contract>): Contract {
  return { id: 'c1', start_date: '2026-01-01', end_date: '2027-01-01', monthly_rent: 5000, company_name: 'דייר', ...p } as unknown as Contract
}
function track(p: Partial<MortgageTrack>): MortgageTrack {
  return { id: 'm1', principal: 0, annual_rate: 0, term_months: 0, start_date: '2026-01-01', grace_months: 0, ...p } as unknown as MortgageTrack
}
function loan(p: Partial<Loan>): Loan {
  return { id: 'l1', repayment_type: 'monthly_fixed', principal: 0, annual_rate: 0, term_months: 0, grace_months: 0, start_date: '2026-01-01', label: 'הלוואה', ...p } as unknown as Loan
}

afterEach(() => vi.useRealTimers())

describe('monthlyVirtualEntries (single month)', () => {
  const c = contract({})
  const t = track({ principal: 120000, annual_rate: 5, term_months: 12 })
  const l = loan({ principal: 50000, annual_rate: 4, term_months: 60 })
  it('generates rent income + mortgage expense + loan expense for the month', () => {
    const e = monthlyVirtualEntries([c], [t], 2026, 6, [l])
    expect(e.find(x => x.direction === 'income' && x.id === 'v-rent-c1-2026-06')).toBeDefined()
    expect(e.find(x => x.id === 'v-mort-2026-06')?.direction).toBe('expense')
    expect(e.find(x => x.id === 'v-loan-l1-2026-06')?.direction).toBe('expense')
  })
  it('no rent row for a month outside the contract window', () => {
    const e = monthlyVirtualEntries([c], [], 2030, 1)
    expect(e.find(x => x.direction === 'income')).toBeUndefined()
  })
})

describe('monthlyVirtualEntries — principal/interest split (issue #22)', () => {
  it('mortgage row carries the Spitzer principal+interest split, summing back to the payment', () => {
    const t = track({ principal: 120000, annual_rate: 5, term_months: 12 })
    const e = monthlyVirtualEntries([], [t], 2026, 6).find(x => x.id === 'v-mort-2026-06')
    expect(e).toBeDefined()
    expect(e!.principal).toBeGreaterThan(0)
    expect(e!.interest).toBeGreaterThan(0)
    expect(e!.principal! + e!.interest!).toBeCloseTo(e!.amount, 6)
  })
  it('monthly_fixed loan row carries the split too', () => {
    const l = loan({ principal: 50000, annual_rate: 4, term_months: 60 })
    const e = monthlyVirtualEntries([], [], 2026, 6, [l]).find(x => x.id === 'v-loan-l1-2026-06')
    expect(e).toBeDefined()
    expect(e!.principal).toBeGreaterThan(0)
    expect(e!.interest).toBeGreaterThan(0)
    expect(e!.principal! + e!.interest!).toBeCloseTo(e!.amount, 6)
  })
  it('a balloon loan (no split available) leaves principal/interest undefined', () => {
    const l = loan({ repayment_type: 'balloon', principal: 50000 })
    const e = monthlyVirtualEntries([], [], 2026, 6, [l]).find(x => x.id === 'v-loan-l1-2026-06')
    expect(e).toBeUndefined() // balloon loans generate no monthly virtual entry at all
  })
})

describe('monthlyVirtualEntries (whole year) uses LOCAL today (no UTC roll-back)', () => {
  it('includes the current month forecast at 00:30 on the 1st (Israel)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-31T21:30:00Z')) // = 2026-06-01 00:30 Asia/Jerusalem
    const e = monthlyVirtualEntries([contract({})], [], 2026) // month undefined → elapsed months
    expect(e.find(x => x.id === 'v-rent-c1-2026-06')).toBeDefined()
  })
})

describe('activeContract', () => {
  it('returns the contract active at asOf', () => {
    const active = contract({})
    const expired = { ...contract({}), id: 'old', start_date: '2024-01-01', end_date: '2024-12-31' } as Contract
    expect(activeContract([expired, active], new Date(2026, 5, 15))?.id).toBe('c1')
  })
  it('returns undefined when none active', () => {
    const old = { ...contract({}), end_date: '2024-12-31' } as Contract
    expect(activeContract([old], new Date(2026, 5, 15))).toBeUndefined()
  })
  it('treats start/end as inclusive whole days (no UTC instant skew)', () => {
    // First day, just after local midnight — should already be active.
    const starting = contract({ start_date: '2026-06-01', end_date: '2026-12-01' })
    expect(activeContract([starting], new Date(2026, 5, 1, 0, 30))?.id).toBe('c1')
    // Last day, mid-morning — should still be active (end date is inclusive).
    const ending = contract({ start_date: '2026-01-01', end_date: '2026-06-01' })
    expect(activeContract([ending], new Date(2026, 5, 1, 10, 0))?.id).toBe('c1')
  })
})

describe('numeric columns arrive from Supabase as STRINGS — forecast sums must coerce, not concatenate', () => {
  it('rent amount is numeric and sums across months (6000 × 3 = 18000, not "0600060006000")', () => {
    const c = contract({ monthly_rent: '6000' as unknown as number, start_date: '2026-01-01', end_date: '2027-01-01' })
    const amts = [1, 2, 3].map(m => {
      const rent = monthlyVirtualEntries([c], [], 2026, m).find(x => x.direction === 'income')
      expect(rent).toBeDefined()
      expect(typeof rent!.amount).toBe('number')
      return rent!.amount
    })
    expect(amts.reduce((s, a) => s + a, 0)).toBe(18000)
  })
  it('insurance forecast sums two string premiums to a number (450.00 + 300.00 = 750)', () => {
    const policies = [
      { monthly_premium: '450.00', start_date: null, end_date: null },
      { monthly_premium: '300.00', start_date: null, end_date: null },
    ] as unknown as { monthly_premium: number | null; start_date: string | null; end_date: string | null }[]
    const ins = monthlyVirtualEntries([], [], 2026, 6, [], policies).find(x => x.category === 'ביטוח')
    expect(ins).toBeDefined()
    expect(typeof ins!.amount).toBe('number')
    expect(ins!.amount).toBe(750)
  })
})

describe('rentReceivedToDate — counts payments due, not calendar months spanned', () => {
  it('a 12-month lease starting mid-month = 12 payments, not 13', () => {
    // 15/1/26 → 14/1/27 spans 13 calendar months but is only 12 rent payments; the
    // old flat "+1" counted 13.
    const c = contract({ start_date: '2026-01-15', end_date: '2027-01-14', monthly_rent: 5000 })
    expect(rentReceivedToDate([c], new Date(2027, 0, 14))).toBe(12 * 5000)
  })
  it('ticks up only once the payment day-of-month is reached', () => {
    const c = contract({ start_date: '2026-01-15', end_date: '2027-06-15', monthly_rent: 5000 })
    expect(rentReceivedToDate([c], new Date(2026, 1, 14))).toBe(1 * 5000) // before the 15th
    expect(rentReceivedToDate([c], new Date(2026, 1, 15))).toBe(2 * 5000) // on the 15th
  })
  it('N6: overlapping contracts count each month ONCE — the newer lease wins', () => {
    // Old lease runs Jan→Jun; its renewal was entered from May (2-month overlap) at a
    // higher rent. One apartment = one rent per month: Jan–Apr old (4×5000), May–Dec
    // new (8×5500). The old per-contract sum double-counted May+June.
    const old = contract({ id: 'c-old', start_date: '2026-01-01', end_date: '2026-06-30', monthly_rent: 5000 })
    const renewal = contract({ id: 'c-new', start_date: '2026-05-01', end_date: '2027-04-30', monthly_rent: 5500 })
    expect(rentReceivedToDate([old, renewal], new Date(2026, 11, 31))).toBe(4 * 5000 + 8 * 5500)
    // Order must not matter.
    expect(rentReceivedToDate([renewal, old], new Date(2026, 11, 31))).toBe(4 * 5000 + 8 * 5500)
  })
  it('N6: a single non-overlapping lease is unchanged by the dedup', () => {
    const c = contract({ start_date: '2026-01-01', end_date: '2027-01-01', monthly_rent: 5000 })
    expect(rentReceivedToDate([c], new Date(2026, 5, 15))).toBe(6 * 5000)
  })
})

describe('paid-to-date helpers', () => {
  it('mortgagePaidToDate sums payments up to the cutoff', () => {
    const t = track({ principal: 120000, annual_rate: 5, term_months: 12 })
    expect(mortgagePaidToDate([t], '2026-06-15')).toBeGreaterThan(0)
    expect(mortgagePaidToDate([t], '2025-01-01')).toBe(0) // before any payment
  })
  it('rentReceivedToDate counts inclusive months × rent', () => {
    expect(rentReceivedToDate([contract({})], new Date(2026, 5, 15))).toBe(6 * 5000) // Jan..Jun = 6
  })
  it('insurancePaidToDate = premium × elapsed months', () => {
    expect(insurancePaidToDate([{ monthly_premium: 100, start_date: '2026-01-01', end_date: '2026-06-01' }])).toBe(500)
  })
  it('elapsedMonths counts whole months between dates', () => {
    expect(elapsedMonths('2026-01-01', '2026-06-01')).toBe(5)
    expect(elapsedMonths(null, '2026-06-01')).toBe(0)
  })
})
