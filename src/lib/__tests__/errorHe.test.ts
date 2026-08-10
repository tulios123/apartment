import { describe, it, expect } from 'vitest'
import { userErrorMessage } from '../errorHe'

// D25: a failed money save showed the raw English exception ("TypeError: Failed
// to fetch"). The mapper must never let untranslated technical text through.

describe('userErrorMessage', () => {
  it('maps a network failure to plain Hebrew with a way out', () => {
    const msg = userErrorMessage(new TypeError('Failed to fetch'), 'השמירה נכשלה — נסו שוב')
    expect(msg).toContain('חיבור')
    expect(msg).not.toMatch(/[A-Za-z]/)
  })

  it("maps WebKit's 'Load failed' the same way", () => {
    expect(userErrorMessage(new TypeError('Load failed'), 'x')).toContain('חיבור')
  })

  it('passes an already-Hebrew message through untouched', () => {
    expect(userErrorMessage(new Error('הסכום חייב להיות גדול מאפס'), 'y')).toBe('הסכום חייב להיות גדול מאפס')
  })

  it('falls back to the Hebrew fallback for unknown technical errors', () => {
    expect(userErrorMessage(new Error('duplicate key value violates unique constraint'), 'השמירה נכשלה — נסו שוב')).toBe('השמירה נכשלה — נסו שוב')
  })

  it('handles non-Error throwables', () => {
    expect(userErrorMessage(undefined, 'ברירת מחדל')).toBe('ברירת מחדל')
  })
})
