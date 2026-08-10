import { describe, it, expect } from 'vitest'
import { reentryGuard } from '../reentryGuard'

// AUD-010: a ghost double-tap on "כן, אשר" fired approveRent twice in one tick
// (disabled={busy} only lands after a re-render) and inserted two rent
// transactions. The guard must reject the second synchronous entry.

describe('reentryGuard', () => {
  it('lets the first caller in', () => {
    const g = reentryGuard()
    expect(g.enter()).toBe(true)
  })

  it('blocks a second entry while the first is in flight (double-tap)', () => {
    const g = reentryGuard()
    expect(g.enter()).toBe(true)
    expect(g.enter()).toBe(false)
    expect(g.enter()).toBe(false)
  })

  it('re-opens after exit — the action can run again later', () => {
    const g = reentryGuard()
    g.enter()
    g.exit()
    expect(g.enter()).toBe(true)
  })

  it('guards an async flow end-to-end: two racing calls → one execution', async () => {
    const g = reentryGuard()
    let runs = 0
    const action = async () => {
      if (!g.enter()) return
      try {
        runs++
        await Promise.resolve()
      } finally {
        g.exit()
      }
    }
    await Promise.all([action(), action()])
    expect(runs).toBe(1)
    // after both settle, a fresh tap works
    await action()
    expect(runs).toBe(2)
  })
})
