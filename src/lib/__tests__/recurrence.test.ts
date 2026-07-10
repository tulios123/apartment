import { describe, it, expect } from 'vitest'
import { nextRecurrence, repeatLabel, MONTHLY, YEARLY } from '../recurrence'

describe('nextRecurrence', () => {
  it('daily → next calendar day', () => {
    expect(nextRecurrence('2026-07-10', 1)).toBe('2026-07-11')
  })

  it('weekly → +7 days, crossing a month boundary', () => {
    expect(nextRecurrence('2026-07-28', 7)).toBe('2026-08-04')
  })

  it('biweekly → +14 days', () => {
    expect(nextRecurrence('2026-07-10', 14)).toBe('2026-07-24')
  })

  it('monthly steps by a calendar month, keeping the day-of-month', () => {
    expect(nextRecurrence('2026-07-10', MONTHLY)).toBe('2026-08-10')
  })

  it('monthly clamps to the shorter month (Jan 31 → Feb 28), never spilling into March', () => {
    expect(nextRecurrence('2026-01-31', MONTHLY)).toBe('2026-02-28')
  })

  it('monthly clamps to a leap February (Jan 31 2028 → Feb 29)', () => {
    expect(nextRecurrence('2028-01-31', MONTHLY)).toBe('2028-02-29')
  })

  it('monthly rolls the year over from December', () => {
    expect(nextRecurrence('2026-12-15', MONTHLY)).toBe('2027-01-15')
  })

  it('yearly steps by a calendar year', () => {
    expect(nextRecurrence('2026-07-10', YEARLY)).toBe('2027-07-10')
  })

  it('yearly on Feb 29 clamps to Feb 28 the following (non-leap) year', () => {
    expect(nextRecurrence('2028-02-29', YEARLY)).toBe('2029-02-28')
  })
})

describe('repeatLabel', () => {
  it('maps stored intervals to their Hebrew label', () => {
    expect(repeatLabel(7)).toBe('כל שבוע')
    expect(repeatLabel(MONTHLY)).toBe('כל חודש')
  })

  it('falls back to "לא חוזרת" for null / unknown values', () => {
    expect(repeatLabel(null)).toBe('לא חוזרת')
    expect(repeatLabel(99)).toBe('לא חוזרת')
  })
})
