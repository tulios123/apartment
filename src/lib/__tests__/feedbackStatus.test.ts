import { describe, it, expect } from 'vitest'
import { canResendToBot } from '../feedbackStatus'

describe('canResendToBot', () => {
  it('allows resending from new, failed, and awaiting_review', () => {
    expect(canResendToBot('new')).toBe(true)
    expect(canResendToBot('failed')).toBe(true)
    // The owner reviewed an open PR, decided it didn't actually fix it, and wants
    // another pass instead of being stuck until it's merged or dropped.
    expect(canResendToBot('awaiting_review')).toBe(true)
  })

  it('blocks resending while a run is already active, or once it is done', () => {
    expect(canResendToBot('sent')).toBe(false)
    expect(canResendToBot('in_progress')).toBe(false)
    expect(canResendToBot('fixed')).toBe(false)
  })
})
