import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatSignedCurrency,
  formatDate,
  todayISO,
  monthDayISO,
  monthEndISO,
  formatNum,
  caretIndexAfterDigits,
} from '../format'

// Strip the bidi control marks (RLM/LRM) + nbsp that Intl injects, so we can assert
// on the human-visible characters.
const strip = (s: string) => s.replace(/[‎‏ ]/g, '').trim()

describe('monthDayISO', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(monthDayISO(new Date(2026, 0, 5))).toBe('2026-01-05') // Jan = month 0
    expect(monthDayISO(new Date(2026, 8, 3))).toBe('2026-09-03') // Sep
    expect(monthDayISO(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
  it('zero-pads month and day', () => {
    expect(monthDayISO(new Date(2026, 2, 7))).toBe('2026-03-07')
  })
})

describe('todayISO', () => {
  it('equals monthDayISO(now) and is a valid YYYY-MM-DD', () => {
    expect(todayISO()).toBe(monthDayISO(new Date()))
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('monthEndISO (last calendar day, no UTC roll-back)', () => {
  it('returns the true last day per month', () => {
    expect(monthEndISO(2026, 1)).toBe('2026-01-31')
    expect(monthEndISO(2026, 4)).toBe('2026-04-30')
    expect(monthEndISO(2026, 12)).toBe('2026-12-31')
  })
  it('handles February in common and leap years', () => {
    expect(monthEndISO(2026, 2)).toBe('2026-02-28') // common
    expect(monthEndISO(2024, 2)).toBe('2024-02-29') // leap
    expect(monthEndISO(2000, 2)).toBe('2000-02-29') // century leap
    expect(monthEndISO(1900, 2)).toBe('1900-02-28') // century non-leap
  })
})

describe('formatCurrency', () => {
  it('formats ILS with thousands separators', () => {
    expect(strip(formatCurrency(1000))).toContain('1,000')
    expect(strip(formatCurrency(1000))).toContain('₪')
  })
  it('rounds to whole shekels', () => {
    expect(strip(formatCurrency(1234.6))).toContain('1,235')
  })
  it('handles zero and negatives', () => {
    expect(strip(formatCurrency(0))).toContain('0')
    expect(strip(formatCurrency(-500))).toContain('500')
  })
})

describe('formatSignedCurrency (sign hugs the number, none for zero)', () => {
  it('shows + for positive', () => {
    const s = strip(formatSignedCurrency(100))
    expect(s).toContain('+')
    expect(s).toContain('100')
  })
  it('shows − for negative', () => {
    const s = strip(formatSignedCurrency(-100))
    expect(s).toMatch(/[-−]/)
    expect(s).toContain('100')
  })
  it('shows NO sign for zero', () => {
    const s = strip(formatSignedCurrency(0))
    expect(s).not.toContain('+')
    expect(s).not.toMatch(/[-−]/)
    expect(s).toContain('0')
  })
})

describe('caretIndexAfterDigits (keeps the caret on the same digit across re-grouping)', () => {
  it('lands right after the Nth digit', () => {
    // "2,500,000" — digit 1 is the "2", digit 4 is the first "0" after it
    expect(caretIndexAfterDigits('2,500,000', 1)).toBe(1)
    expect(caretIndexAfterDigits('2,500,000', 4)).toBe(5) // "2,500|,000"
  })
  it('handles a newly-inserted comma shifting later digits', () => {
    // typing "9" before "999" turns "999" into "9,999" — caret was after
    // digit 1, should stay after digit 1 (before the new comma)
    expect(caretIndexAfterDigits('9,999', 1)).toBe(1)
  })
  it('returns 0 when no digits precede the caret', () => {
    expect(caretIndexAfterDigits('1,234', 0)).toBe(0)
  })
  it('clamps to the end when asked for more digits than exist', () => {
    expect(caretIndexAfterDigits('1,234', 99)).toBe(5)
  })
  it('returns 0 for an empty formatted string', () => {
    expect(caretIndexAfterDigits('', 0)).toBe(0)
  })
})

describe('formatDate', () => {
  it('formats an ISO date in he-IL', () => {
    expect(formatDate('2026-06-24')).toContain('2026')
  })
  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('')
  })
})

describe('formatNum', () => {
  it('adds thousands separators', () => {
    expect(formatNum('1000')).toBe('1,000')
    expect(formatNum(1234567)).toBe('1,234,567')
  })
  it('passes through empty and non-numeric', () => {
    expect(formatNum('')).toBe('')
    expect(formatNum('abc')).toBe('abc')
  })
})
