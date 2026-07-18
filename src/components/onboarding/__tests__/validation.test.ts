import { describe, it, expect } from 'vitest'
import {
  trackMissingFields, loanMissingFields, termMonthsValid,
  trackDraftHasData, loanDraftHasData, clampGraceMonths,
} from '../validation'
import { emptyTrack, emptyLoan } from '../types'
import type { TrackDraft, LoanDraft } from '../types'

const track = (over: Partial<TrackDraft>): TrackDraft => ({ ...emptyTrack('2026-03-11'), ...over })
const loan = (over: Partial<LoanDraft>): LoanDraft => ({ ...emptyLoan('2026-03-11'), ...over })

describe('termMonthsValid', () => {
  it('rejects empty, "0" and negatives; accepts positive months', () => {
    expect(termMonthsValid('')).toBe(false)
    expect(termMonthsValid('0')).toBe(false)     // the owner-reported bug: 0 passed as a term
    expect(termMonthsValid('-12')).toBe(false)
    expect(termMonthsValid('1')).toBe(true)
    expect(termMonthsValid('360')).toBe(true)
  })
})

describe('trackMissingFields', () => {
  it('a complete track passes', () => {
    expect(trackMissingFields(track({ principal: '600000', annual_rate: '4.5', term_months: '360' }))).toEqual([])
  })

  it('a term of "0" months is missing — never silently replaced by 360 at save', () => {
    const m = trackMissingFields(track({ principal: '600000', annual_rate: '4.5', term_months: '0' }))
    expect(m).toContain('תקופה')
  })

  it('a negative term is missing', () => {
    expect(trackMissingFields(track({ principal: '600000', annual_rate: '4.5', term_months: '-6' }))).toContain('תקופה')
  })

  it('flags a missing principal', () => {
    expect(trackMissingFields(track({ annual_rate: '4.5', term_months: '360' }))).toContain('סכום')
  })
})

describe('loanMissingFields', () => {
  it('a monthly loan with a "0" term is missing תקופה', () => {
    const m = loanMissingFields(loan({ principal: '120000', annual_rate: '6', term_months: '0' }))
    expect(m).toContain('תקופה')
  })

  it('a monthly loan with rate+term passes', () => {
    expect(loanMissingFields(loan({ principal: '120000', annual_rate: '6', term_months: '60' }))).toEqual([])
  })

  it('a balloon loan needs only a principal (no rate/term)', () => {
    expect(loanMissingFields(loan({ repayment_type: 'balloon', principal: '80000' }))).toEqual([])
    expect(loanMissingFields(loan({ repayment_type: 'balloon' }))).toEqual(['סכום'])
  })
})

describe('draft has-data (untouched forms must skip silently)', () => {
  it('an untouched empty form has NO data — grey rate defaults never count', () => {
    expect(trackDraftHasData(emptyTrack('2026-03-11'))).toBe(false)
    expect(loanDraftHasData(emptyLoan('2026-03-11'))).toBe(false)
  })

  it('any raw typed field counts as data', () => {
    expect(trackDraftHasData(track({ term_months: '240' }))).toBe(true)
    expect(trackDraftHasData(track({ principal: '100000' }))).toBe(true)
    expect(loanDraftHasData(loan({ annual_rate: '3' }))).toBe(true)
  })
})

describe('clampGraceMonths', () => {
  it('clamps grace below the term (matches the schedule engine, EDGE-12)', () => {
    expect(clampGraceMonths('24', '12')).toBe(11)
    expect(clampGraceMonths('12', '360')).toBe(12)
  })

  it('empty/zero grace stays 0', () => {
    expect(clampGraceMonths('', '360')).toBe(0)
    expect(clampGraceMonths('0', '360')).toBe(0)
  })
})
