import { describe, it, expect } from 'vitest'
import { shouldConfirmDiscard } from '../discardGuard'
// (discardGuard moved from components/capture → lib; shared by capture sheets + page forms)

describe('shouldConfirmDiscard', () => {
  it('does not prompt for an empty draft', () => {
    expect(shouldConfirmDiscard(false, 'idle')).toBe(false)
  })

  it('prompts once content was entered (owner request #28)', () => {
    expect(shouldConfirmDiscard(true, 'idle')).toBe(true)
  })

  it('does not prompt while saving or after a successful save', () => {
    expect(shouldConfirmDiscard(true, 'saving')).toBe(false)
    expect(shouldConfirmDiscard(true, 'done')).toBe(false)
  })
})
