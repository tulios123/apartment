import { describe, it, expect } from 'vitest'
import { nextDueDate, recurrenceLabel, RECURRENCE_OPTIONS } from '../recurrence'

describe('nextDueDate', () => {
  it('advances day intervals', () => {
    expect(nextDueDate('2026-07-10', 1)).toBe('2026-07-11')  // daily
    expect(nextDueDate('2026-07-10', 7)).toBe('2026-07-17')  // weekly
    expect(nextDueDate('2026-07-10', 14)).toBe('2026-07-24') // biweekly
  })

  it('rolls day intervals across month and year boundaries', () => {
    expect(nextDueDate('2026-07-28', 7)).toBe('2026-08-04')
    expect(nextDueDate('2026-12-28', 7)).toBe('2027-01-04')
  })

  it('advances whole calendar months (not 30 days)', () => {
    expect(nextDueDate('2026-01-10', -1)).toBe('2026-02-10')
    expect(nextDueDate('2026-07-10', -1)).toBe('2026-08-10')
    expect(nextDueDate('2026-12-10', -1)).toBe('2027-01-10')
  })

  it('clamps a month recurrence to the target month last day', () => {
    // Jan 31 + 1 month must land on Feb 28, never spill into March.
    expect(nextDueDate('2026-01-31', -1)).toBe('2026-02-28')
    // Leap year: Feb has 29 days.
    expect(nextDueDate('2028-01-31', -1)).toBe('2028-02-29')
    // Mar 31 + 1 month → Apr 30.
    expect(nextDueDate('2026-03-31', -1)).toBe('2026-04-30')
  })

  it('advances yearly', () => {
    expect(nextDueDate('2026-07-10', -12)).toBe('2027-07-10')
  })

  it('returns null when the task does not repeat or has no date', () => {
    expect(nextDueDate('2026-07-10', null)).toBeNull()
    expect(nextDueDate('2026-07-10', 0)).toBeNull()
    expect(nextDueDate(null, 7)).toBeNull()
  })
})

describe('recurrenceLabel', () => {
  it('labels the known presets', () => {
    expect(recurrenceLabel(1)).toBe('כל יום')
    expect(recurrenceLabel(7)).toBe('כל שבוע')
    expect(recurrenceLabel(-1)).toBe('כל חודש')
    expect(recurrenceLabel(-12)).toBe('כל שנה')
  })

  it('describes an unknown interval honestly', () => {
    expect(recurrenceLabel(3)).toBe('כל 3 ימים')
    expect(recurrenceLabel(-2)).toBe('כל 2 חודשים')
  })

  it('returns null for no recurrence', () => {
    expect(recurrenceLabel(null)).toBeNull()
    expect(recurrenceLabel(0)).toBeNull()
  })
})

describe('RECURRENCE_OPTIONS', () => {
  it('leads with a no-repeat option', () => {
    expect(RECURRENCE_OPTIONS[0].value).toBeNull()
  })
})
