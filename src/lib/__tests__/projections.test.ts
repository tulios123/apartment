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
