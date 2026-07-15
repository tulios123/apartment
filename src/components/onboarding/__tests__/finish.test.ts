import { describe, it, expect } from 'vitest'
import { finishOutcome, emptySavedSections } from '../finish'

describe('finishOutcome', () => {
  it('all sections saved → finalize, no error', () => {
    expect(finishOutcome([])).toEqual({ finalize: true, errorMessage: null })
  })

  it('a partial failure → do NOT finalize, and surface what to retry', () => {
    const out = finishOutcome(['משכנתא'])
    expect(out.finalize).toBe(false)              // must NOT clear draft / claim "הכול מוכן!"
    expect(out.errorMessage).toContain('משכנתא')  // names the section that failed
    expect(out.errorMessage).toContain('נסו שוב') // invites a retry
  })

  it('multiple failures are all named', () => {
    const out = finishOutcome(['משכנתא', 'ביטוח'])
    expect(out.finalize).toBe(false)
    expect(out.errorMessage).toContain('משכנתא')
    expect(out.errorMessage).toContain('ביטוח')
  })
})

describe('emptySavedSections', () => {
  it('starts with nothing saved', () => {
    expect(emptySavedSections()).toEqual({
      tracks: false, loans: false, costs: false, policies: false, reminder: false, contract: null,
    })
  })
})
