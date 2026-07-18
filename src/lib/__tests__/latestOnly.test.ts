import { describe, it, expect } from 'vitest'
import { latestOnly } from '../latestOnly'

// SW-12: the data hooks used to apply WHICHEVER fetch resolved last — a slow
// stale response could overwrite a newer month's data, and an unmounted
// screen's fetch still wrote state. The guard must let only the latest
// invocation commit.

describe('latestOnly', () => {
  it('a single invocation stays fresh until superseded', () => {
    const g = latestOnly()
    const fresh = g.start()
    expect(fresh()).toBe(true)
  })

  it('an older invocation goes stale the moment a newer one starts', () => {
    const g = latestOnly()
    const first = g.start()
    const second = g.start()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  it('invalidate kills every in-flight invocation (unmount)', () => {
    const g = latestOnly()
    const fresh = g.start()
    g.invalidate()
    expect(fresh()).toBe(false)
  })

  it('end-to-end race: the slow FIRST response must not overwrite the fast SECOND', async () => {
    const g = latestOnly()
    let committed = ''
    const fetchMonth = async (label: string, delayMs: number) => {
      const fresh = g.start()
      await new Promise(r => setTimeout(r, delayMs))
      if (!fresh()) return
      committed = label
    }
    // month A starts first but resolves last — classic fast month-switch
    await Promise.all([fetchMonth('A-stale', 30), fetchMonth('B-latest', 5)])
    expect(committed).toBe('B-latest')
  })
})
