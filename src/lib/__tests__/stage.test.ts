import { describe, it, expect } from 'vitest'
import { possession, leaseStatus, countdownLabel } from '../stage'

const today = '2026-09-07'

describe('possession', () => {
  it('is awaiting the key while the delivery date is ahead', () => {
    expect(possession('2027-04-01', today)).toBe('awaiting_key')
  })

  it('flips by itself on the delivery date', () => {
    // The whole point of deriving rather than storing: no transition to run, no job to
    // schedule. The day the date arrives, every screen reads the new stage.
    expect(possession(today, today)).toBe('in_hand')
    expect(possession('2026-09-06', today)).toBe('in_hand')
  })

  it('treats a missing date as possession, so no existing owner changes behaviour', () => {
    // Every account created before this feature has no key-delivery date, or one long
    // past. They must all read exactly as they did yesterday.
    expect(possession(null, today)).toBe('in_hand')
    expect(possession(undefined, today)).toBe('in_hand')
    expect(possession('', today)).toBe('in_hand')
  })
})

describe('leaseStatus', () => {
  const lease = (start: string, end: string) => ({ start_date: start, end_date: end })

  it('is leased when a contract covers today, inclusive of both ends', () => {
    expect(leaseStatus([lease('2026-03-01', '2027-02-28')], today)).toBe('leased')
    expect(leaseStatus([lease(today, '2027-09-06')], today)).toBe('leased')
    expect(leaseStatus([lease('2025-09-08', today)], today)).toBe('leased')
  })

  it('is signed when a lease exists but has not started', () => {
    // A buyer awaiting keys who already found a tenant: waiting AND signed at once.
    expect(leaseStatus([lease('2027-04-01', '2028-03-31')], today)).toBe('signed')
  })

  it('is searching once every lease has ended', () => {
    expect(leaseStatus([lease('2024-01-01', '2025-12-31')], today)).toBe('searching')
  })

  it('is none when there was never a lease', () => {
    expect(leaseStatus([], today)).toBe('none')
  })

  it('prefers the live lease over an expired one', () => {
    expect(leaseStatus(
      [lease('2024-01-01', '2025-12-31'), lease('2026-03-01', '2027-02-28')], today,
    )).toBe('leased')
  })
})

describe('the two facts combine', () => {
  it('describes a buyer who is still waiting but already has a tenant lined up', () => {
    expect(possession('2027-04-01', today)).toBe('awaiting_key')
    expect(leaseStatus([{ start_date: '2027-04-01', end_date: '2028-03-31' }], today)).toBe('signed')
  })

  it('describes every current owner: keys in hand, tenant in place', () => {
    expect(possession(null, today)).toBe('in_hand')
    expect(leaseStatus([{ start_date: '2026-03-01', end_date: '2027-02-28' }], today)).toBe('leased')
  })
})

describe('countdownLabel', () => {
  it('names the near days rather than counting them', () => {
    expect(countdownLabel(0)).toBe('היום')
    expect(countdownLabel(-3)).toBe('היום')   // the date has arrived; the stage flips today
    expect(countdownLabel(1)).toBe('מחר')
  })

  it('uses the Hebrew dual form for two', () => {
    expect(countdownLabel(2)).toBe('בעוד יומיים')
    expect(countdownLabel(61)).toBe('בעוד כחודשיים')
  })

  it('counts days below a month and months above it', () => {
    expect(countdownLabel(9)).toBe('בעוד 9 ימים')
    expect(countdownLabel(30)).toBe('בעוד 30 ימים')
    expect(countdownLabel(213)).toBe('בעוד כ-7 חודשים')
  })

  it('stays approximate above a month — the exact date is shown beside it', () => {
    expect(countdownLabel(31)).toBe('בעוד כחודש')
    expect(countdownLabel(40)).toBe('בעוד כחודש')
  })
})
