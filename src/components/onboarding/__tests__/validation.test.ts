import { describe, it, expect } from 'vitest'
import {
  trackIssues, loanIssues, termMonthsValid, issueText,
  trackDraftHasData, loanDraftHasData, clampGraceMonths,
  trackWarnings, loanWarnings,
} from '../validation'
import { emptyTrack, emptyLoan } from '../types'
import type { TrackDraft, LoanDraft } from '../types'

const track = (over: Partial<TrackDraft>): TrackDraft => ({ ...emptyTrack('2026-03-11'), ...over })
const loan = (over: Partial<LoanDraft>): LoanDraft => ({ ...emptyLoan('2026-03-11'), ...over })
const fields = (issues: { field: string }[]) => issues.map(i => i.field)

describe('termMonthsValid', () => {
  it('rejects empty, "0" and negatives; accepts positive months', () => {
    expect(termMonthsValid('')).toBe(false)
    expect(termMonthsValid('0')).toBe(false)     // the owner-reported bug: 0 passed as a term
    expect(termMonthsValid('-12')).toBe(false)
    expect(termMonthsValid('1')).toBe(true)
    expect(termMonthsValid('360')).toBe(true)
  })
})

describe('trackIssues', () => {
  it('a complete track passes', () => {
    expect(trackIssues(track({ principal: '600000', annual_rate: '4.5', term_months: '360' }))).toEqual([])
  })

  it('a term of "0" months is invalid — with a message that says so, not "missing"', () => {
    const issues = trackIssues(track({ principal: '600000', annual_rate: '4.5', term_months: '0' }))
    expect(fields(issues)).toEqual(['term'])
    expect(issues[0].message).toContain('חודש אחד')          // precise: must be ≥ 1 month
    expect(issues[0].message).not.toContain('חסרה')          // it isn't empty — don't say "missing"
  })

  it('an EMPTY term reads as missing (different message than an invalid one)', () => {
    const issues = trackIssues(track({ principal: '600000', annual_rate: '4.5' }))
    expect(fields(issues)).toEqual(['term'])
    expect(issues[0].message).toContain('חסרה תקופה')
  })

  it('a negative term is invalid', () => {
    expect(fields(trackIssues(track({ principal: '600000', annual_rate: '4.5', term_months: '-6' })))).toEqual(['term'])
  })

  it('flags a missing principal on the principal field', () => {
    const issues = trackIssues(track({ annual_rate: '4.5', term_months: '360' }))
    expect(fields(issues)).toEqual(['principal'])
    expect(issues[0].message).toBe('חסר סכום')
  })

  it('a typed principal of "0" gets the greater-than-zero message', () => {
    const issues = trackIssues(track({ principal: '0', annual_rate: '4.5', term_months: '360' }))
    expect(issues[0].message).toContain('גדול מאפס')
  })
})

describe('loanIssues', () => {
  it('a monthly loan with a "0" term is invalid on the term field', () => {
    const issues = loanIssues(loan({ principal: '120000', annual_rate: '6', term_months: '0' }))
    expect(fields(issues)).toEqual(['term'])
  })

  it('a monthly loan with rate+term passes', () => {
    expect(loanIssues(loan({ principal: '120000', annual_rate: '6', term_months: '60' }))).toEqual([])
  })

  it('a monthly loan without a rate says the rate is missing', () => {
    const issues = loanIssues(loan({ principal: '120000', term_months: '60' }))
    expect(fields(issues)).toEqual(['rate'])
    expect(issues[0].message).toContain('חסרה ריבית')
  })

  it('a balloon loan needs only a principal (no rate/term)', () => {
    expect(loanIssues(loan({ repayment_type: 'balloon', principal: '80000' }))).toEqual([])
    expect(fields(loanIssues(loan({ repayment_type: 'balloon' })))).toEqual(['principal'])
  })
})

describe('issueText', () => {
  it('joins messages for one-line chips/dialog rows', () => {
    const issues = trackIssues(track({ term_months: '0' }))
    expect(issueText(issues)).toContain('חסר סכום')
    expect(issueText(issues)).toContain(' · ')
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

describe('plausibility warnings (soft, never block)', () => {
  it('a short mortgage term looks like years — suggests the months equivalent', () => {
    const w = trackWarnings(track({ principal: '1000000', annual_rate: '4.5', term_months: '1' }))
    expect(w.some(x => x.includes('12 חודשים'))).toBe(true)   // 1 → suggests 1×12
    expect(trackWarnings(track({ term_months: '30' }))[0]).toContain('360')
  })

  it('normal terms and an empty field warn nothing', () => {
    expect(trackWarnings(track({ principal: '600000', annual_rate: '4.5', term_months: '360' }))).toEqual([])
    expect(trackWarnings(track({}))).toEqual([])
  })

  it('an implausible rate or amount warns', () => {
    expect(trackWarnings(track({ annual_rate: '25', term_months: '360' })).some(x => x.includes('ריבית'))).toBe(true)
    expect(trackWarnings(track({ principal: '99999999', term_months: '360' })).some(x => x.includes('גבוה במיוחד'))).toBe(true)
    expect(loanWarnings(loan({ annual_rate: '30' })).some(x => x.includes('ריבית'))).toBe(true)
  })

  it('a balloon loan never warns about rate/term', () => {
    expect(loanWarnings(loan({ repayment_type: 'balloon', principal: '80000' }))).toEqual([])
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
