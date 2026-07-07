import { describe, it, expect } from 'vitest'
import type { MortgageTrack, Loan } from '../../types'
import { splitForMonth, currentSplit, principalNext12Months } from '../equity'
import { trackSchedule } from '../mortgage'

function track(p: Partial<MortgageTrack>): MortgageTrack {
  return { principal: 0, annual_rate: 0, term_months: 0, start_date: '2026-01-01', grace_months: 0, ...p } as unknown as MortgageTrack
}
function loan(p: Partial<Loan>): Loan {
  return { repayment_type: 'monthly_fixed', principal: 0, annual_rate: 0, term_months: 0, grace_months: 0, start_date: '2026-01-01', ...p } as unknown as Loan
}

const T = track({ principal: 120000, annual_rate: 5, term_months: 12, start_date: '2026-01-01' })

describe('splitForMonth', () => {
  it('matches the schedule row for that month', () => {
    const row = trackSchedule(T).find(r => r.date.slice(0, 7) === '2026-06')!
    const s = splitForMonth([T], [], '2026-06')
    expect(s.principal).toBeCloseTo(row.principal, 6)
    expect(s.interest).toBeCloseTo(row.interest, 6)
    expect(s.total).toBeCloseTo(row.principal + row.interest, 6)
  })
  it('balloon loans contribute nothing', () => {
    const s = splitForMonth([], [loan({ repayment_type: 'balloon', principal: 50000 })], '2026-06')
    expect(s.total).toBe(0)
  })
  it('months with no payment → zero', () => {
    expect(splitForMonth([T], [], '2030-01').total).toBe(0)
  })
})

describe('currentSplit (this-month, uses LOCAL month — no UTC roll-back)', () => {
  it('on the 1st of the month returns THIS month, not the previous one', () => {
    // asOf = local 2026-06-01 00:00. A UTC month string (toISOString) would read "2026-05".
    const s = currentSplit([T], [], new Date(2026, 5, 1, 0, 0))
    const june = splitForMonth([T], [], '2026-06')
    expect(s.principal).toBeCloseTo(june.principal, 6)
    expect(s.interest).toBeCloseTo(june.interest, 6)
  })
  it('falls back to the next paying month when this month has no payment', () => {
    // T pays Feb 2026 → Jan 2027. asOf in Dec 2025 has no payment → first future = Feb 2026.
    const s = currentSplit([T], [], new Date(2025, 11, 15))
    expect(s.total).toBeGreaterThan(0)
  })
})

describe('principalNext12Months', () => {
  it('sums 12 months of principal (positive, equals manual sum)', () => {
    const asOf = new Date(2026, 0, 15)
    const v = principalNext12Months([T], [], asOf)
    expect(v).toBeGreaterThan(0)
    // T amortizes 120000 over 12 months from Feb-2026; the 12 months Jan-2026..Dec-2026
    // cover Feb..Dec (11 payments) — so it's the sum of those principals.
    let manual = 0
    for (const r of trackSchedule(T)) if (r.date >= '2026-01' && r.date < '2027-01') manual += r.principal
    expect(v).toBeCloseTo(manual, 4)
  })
  it('is day-of-month independent — a 31st asOf must not skip/double a month (setMonth overflow)', () => {
    const long = track({ principal: 500000, annual_rate: 5, term_months: 360, start_date: '2020-01-15' })
    const fromDay1 = principalNext12Months([long], [], new Date(2026, 0, 1))
    const fromDay31 = principalNext12Months([long], [], new Date(2026, 0, 31))
    // Both walk the same 12 calendar months (Jan..Dec 2026); the old shift() overflowed a
    // day-31 asOf into skipping February and counting March twice.
    expect(fromDay31).toBeCloseTo(fromDay1, 6)
  })
})
