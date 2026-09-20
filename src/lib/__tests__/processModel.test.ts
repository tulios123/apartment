import { describe, it, expect } from 'vitest'
import { PROCESS, itemDate, type ProcessItem } from '../../pages/preview/processModel'

const all: ProcessItem[] = PROCESS.flatMap(p => p.items)

// The signing date and the handover date are 253 days apart here — roughly the real gap
// in the account the preview draws.
const SIGNING = '2026-07-10'
const HANDOVER = '2027-04-09'

describe('the process model holds its own shape', () => {
  it('every id is unique — ticking one item must not tick another', () => {
    const ids = all.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('anything waiting on someone else says who', () => {
    // Without a name, "ממתין" is just a shrug; the whole class exists to answer "on whom".
    for (const i of all.filter(x => x.dep === 'third')) {
      expect(i.waitingOn, `${i.id} has no waitingOn`).toBeTruthy()
    }
  })

  it('anything anchored to a clock carries an offset, and nothing else does', () => {
    for (const i of all) {
      if (i.anchor === 'signing' || i.anchor === 'handover') {
        expect(i.offset, `${i.id} is anchored but has no offset`).toBeTypeOf('number')
      } else {
        expect(i.offset, `${i.id} has an offset with no clock`).toBeUndefined()
      }
    }
  })

  it('keeps BOTH clocks — the finding that broke the first attempt', () => {
    // purchaseTasks.ts counted everything back from handover, so the legal deadlines that
    // run from the signing date could not be expressed at all. If this ever reads zero,
    // the model has quietly collapsed back to one clock.
    expect(all.filter(i => i.anchor === 'signing').length).toBeGreaterThan(0)
    expect(all.filter(i => i.anchor === 'handover').length).toBeGreaterThan(0)
  })

  it('marks the developer-only facts, so the second-hand list is not a lie', () => {
    const ids = all.filter(i => i.developerOnly).map(i => i.id)
    expect(ids).toContain('index')       // מדד תשומות הבנייה
    expect(ids).toContain('guarantee')   // ערבות חוק מכר
    expect(ids).toContain('defects')     // שנת בדק
  })
})

describe('itemDate', () => {
  it('counts purchase tax forward from SIGNING, not back from handover', () => {
    expect(itemDate(all.find(i => i.id === 'tax-report')!, SIGNING, HANDOVER)).toBe('2026-08-09')
    expect(itemDate(all.find(i => i.id === 'tax-pay')!, SIGNING, HANDOVER)).toBe('2026-09-08')
  })

  it('counts the handover items from the key date', () => {
    expect(itemDate(all.find(i => i.id === 'protocol')!, SIGNING, HANDOVER)).toBe(HANDOVER)
    expect(itemDate(all.find(i => i.id === 'inspection')!, SIGNING, HANDOVER)).toBe('2027-03-26')
  })

  it('crosses a year boundary without drifting a day (local dates, never UTC)', () => {
    expect(itemDate(all.find(i => i.id === 'defects')!, SIGNING, HANDOVER)).toBe('2028-04-08')
  })

  it('returns null when an item has no clock of its own', () => {
    expect(itemDate(all.find(i => i.id === 'pre-approval')!, SIGNING, HANDOVER)).toBeNull()
    expect(itemDate(all.find(i => i.id === 'index')!, SIGNING, HANDOVER)).toBeNull()
  })
})
