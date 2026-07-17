import { describe, it, expect } from 'vitest'
import { isForecastMonth } from '../forecast'

// today = 17 July 2026 (month index 6 → month 7)
const today = new Date(2026, 6, 17)

describe('isForecastMonth', () => {
  it('the current month is NOT a forecast (it holds real, booked transactions)', () => {
    expect(isForecastMonth(2026, 7, today)).toBe(false)
  })

  it('a past month in the same year is NOT a forecast', () => {
    expect(isForecastMonth(2026, 6, today)).toBe(false)
    expect(isForecastMonth(2026, 1, today)).toBe(false)
  })

  it('a later month in the same year IS a forecast', () => {
    expect(isForecastMonth(2026, 8, today)).toBe(true)
    expect(isForecastMonth(2026, 12, today)).toBe(true)
  })

  it('any month of a future year IS a forecast', () => {
    expect(isForecastMonth(2027, 1, today)).toBe(true)
  })

  it('any month of a past year is NOT a forecast', () => {
    expect(isForecastMonth(2025, 12, today)).toBe(false)
  })
})
