import { describe, it, expect } from 'vitest'
import { probeHasProperty } from '../bootCheck'

// AUD-011: a network-level failure at boot REJECTS the supabase promise (it is
// not returned as { error }), which used to skip the C3 retry ladder and leave
// the user on an infinite splash. The probe must fold both failure shapes.

describe('probeHasProperty', () => {
  it('true when a property row exists', async () => {
    expect(await probeHasProperty(async () => ({ data: [{ id: 'p1' }], error: null }))).toBe(true)
  })

  it('false for an empty account (routes to onboarding)', async () => {
    expect(await probeHasProperty(async () => ({ data: [], error: null }))).toBe(false)
  })

  it("supabase { error } → 'error' (retry, never \"no property\")", async () => {
    expect(await probeHasProperty(async () => ({ data: null, error: { message: '500' } }))).toBe('error')
  })

  it("a REJECTED fetch (offline boot) → 'error', not an unhandled throw", async () => {
    expect(await probeHasProperty(() => Promise.reject(new TypeError('Failed to fetch')))).toBe('error')
  })
})
