import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The conflict rule for the plan now that it lives on the server (migration 050).
 *
 * The whole point of the move is that a plan trapped in one browser can vanish. The rule
 * that decides which copy wins is therefore the part worth pinning: get it wrong in one
 * direction and a cleared browser still loses the plan; get it wrong in the other and
 * opening a laptop with a stale cache silently overwrites work done on the phone.
 */

// The unit suite runs in node (no DOM), and this module's cache is localStorage. A tiny
// in-memory stand-in is enough and keeps the suite free of a jsdom dependency.
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
} as Storage

type Row = { plan: unknown } | null
let serverRow: Row = null
let upserted: unknown = null
let deleted = false
let failSelect = false

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            failSelect ? { data: null, error: new Error('offline') } : { data: serverRow, error: null },
        }),
      }),
      upsert: (row: Record<string, unknown>) => {
        upserted = row
        return Promise.resolve({ error: null })
      },
      delete: () => ({ eq: async () => { deleted = true; return { error: null } } }),
    }),
  },
}))

const { loadPlan, savePlan, clearPlan, syncPlan } = await import('../purchasePlan')

const UID = 'u1'
const plan = (updatedAt?: string, price = 100) =>
  ({ version: 1 as const, price, signing: '2026-01-01', handover: '2026-06-01',
     firstPct: 10, secondPct: 15, singleApartment: true, items: [], ...(updatedAt ? { updatedAt } : {}) })

beforeEach(() => {
  localStorage.clear()
  serverRow = null; upserted = null; deleted = false; failSelect = false
})

describe('which copy of the plan wins', () => {
  it('a plan that exists only in this browser is pushed to the server', async () => {
    savePlan(UID, plan())
    upserted = null
    const out = await syncPlan(UID)
    expect(out?.price).toBe(100)
    expect(upserted, 'this is how every existing plan gets off the browser it is trapped in').not.toBeNull()
  })

  it('a plan that exists only on the server is adopted — the cleared-browser case', async () => {
    serverRow = { plan: plan('2026-09-20T10:00:00Z', 250) }
    const out = await syncPlan(UID)
    expect(out?.price).toBe(250)
    expect(loadPlan(UID)?.price, 'and cached, so the synchronous reads see it').toBe(250)
  })

  it('the newer of the two wins, in both directions', async () => {
    // Written straight into the cache, because savePlan deliberately stamps the CURRENT
    // time — an older local copy can only come from an earlier session, which is exactly
    // the situation being modelled (a laptop opened days after the phone was used).
    const cache = (p: ReturnType<typeof plan>) => localStorage.setItem(`purchase_plan:${UID}`, JSON.stringify(p))

    cache(plan('2026-09-01T00:00:00Z', 1))
    serverRow = { plan: plan('2026-09-20T00:00:00Z', 2) }
    expect((await syncPlan(UID))?.price, 'server is newer').toBe(2)

    cache(plan('2026-09-25T00:00:00Z', 3))
    serverRow = { plan: plan('2026-09-20T00:00:00Z', 2) }
    expect((await syncPlan(UID))?.price, 'local is newer').toBe(3)
  })

  it('a save always stamps NOW, so a stale cache can never look newer than it is', () => {
    const before = new Date().toISOString()
    savePlan(UID, plan('2020-01-01T00:00:00Z'))
    expect(loadPlan(UID)!.updatedAt! >= before).toBe(true)
  })

  it('a plan saved before the migration has no timestamp and loses to the server', async () => {
    // Written the old way — straight into storage, no updatedAt.
    localStorage.setItem(`purchase_plan:${UID}`, JSON.stringify(plan(undefined, 7)))
    serverRow = { plan: plan('2026-09-20T00:00:00Z', 8) }
    expect(
      (await syncPlan(UID))?.price,
      'the server copy can only have come from a newer client, so it is the newer one',
    ).toBe(8)
  })

  it('offline leaves the cache authoritative — nothing is lost and nothing is claimed', async () => {
    savePlan(UID, plan('2026-09-25T00:00:00Z', 42))
    failSelect = true
    expect((await syncPlan(UID))?.price).toBe(42)
  })

  it('an empty account stays empty', async () => {
    expect(await syncPlan(UID)).toBeNull()
  })

  it('clearing removes both copies', () => {
    savePlan(UID, plan())
    clearPlan(UID)
    expect(loadPlan(UID)).toBeNull()
    expect(deleted, 'otherwise the next sync would resurrect it').toBe(true)
  })

  it('every save stamps a time, or the rule above has nothing to compare', () => {
    savePlan(UID, plan())
    expect(loadPlan(UID)?.updatedAt).toBeTruthy()
  })
})
