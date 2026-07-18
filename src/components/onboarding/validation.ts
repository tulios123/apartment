import type { TrackDraft, LoanDraft } from './types'

// ── Shared completeness gates for mortgage-track and loan drafts ──────────────
// ONE definition of "complete enough to save", used by the mortgage/loans steps
// (המשך), the finish path (סיימו עכשיו / סיום) and unit tests. These bars used to
// be duplicated per call-site and drifted — e.g. a term of "0" months passed the
// string-truthiness check everywhere, then silently became 360 at save.
//
// Each issue names the offending field (so forms can outline the exact input)
// and carries a precise, self-contained Hebrew message — "חסרה תקופה" for an
// empty field vs "התקופה חייבת להיות לפחות חודש אחד" for a typed 0.

export type IssueField = 'principal' | 'rate' | 'term'
export type DraftIssue = { field: IssueField; message: string }

/** Effective annual rate of a track draft — anchor+margin for prime/variable
 *  (with the form's grey-placeholder defaults), plain fixed rate otherwise. */
export function trackEffectiveRate(d: TrackDraft): number {
  if (d.track_type === 'prime') {
    return (parseFloat(d.prime_rate) || 6.25) + (parseFloat(d.margin) || -0.5)
  }
  if (d.track_type === 'variable') {
    return (parseFloat(d.prime_rate) || 0) + (parseFloat(d.margin) || 0)
  }
  return parseFloat(d.annual_rate) || 5.0
}

/** Effective annual rate for a loan draft — anchor + margin for prime/variable
 *  ("prime minus" = negative margin), otherwise the plain fixed rate. No magic
 *  defaults: an empty anchored loan reads as 0, mirroring the liabilities editor. */
export function loanDraftRate(d: LoanDraft): number {
  if (d.track_type === 'prime' || d.track_type === 'variable') {
    return (parseFloat(d.prime_rate) || 0) + (parseFloat(d.margin) || 0)
  }
  return parseFloat(d.annual_rate) || 0
}

/** A term must be a positive whole number of months — "0", a negative value and
 *  an empty field all count as invalid, so the save-path fallback (360) can never
 *  replace a number the user actually typed. */
export function termMonthsValid(raw: string): boolean {
  return (parseInt(raw, 10) || 0) > 0
}

const principalIssue = (raw: string): DraftIssue | null => {
  if (raw === '') return { field: 'principal', message: 'חסר סכום' }
  if ((parseFloat(raw) || 0) <= 0) return { field: 'principal', message: 'הסכום חייב להיות גדול מאפס' }
  return null
}

const termIssue = (raw: string): DraftIssue | null => {
  if (raw === '') return { field: 'term', message: 'חסרה תקופה (בחודשים)' }
  if (!termMonthsValid(raw)) return { field: 'term', message: 'התקופה חייבת להיות לפחות חודש אחד' }
  return null
}

export function trackIssues(d: TrackDraft): DraftIssue[] {
  const issues: DraftIssue[] = []
  const p = principalIssue(d.principal)
  if (p) issues.push(p)
  if (trackEffectiveRate(d) <= 0) {
    // Only variable (no grey defaults) can be "empty"; prime/fixed reach ≤0 only
    // through values the user actually typed (e.g. an over-large negative margin).
    issues.push(d.track_type === 'variable' && !d.prime_rate && !d.margin
      ? { field: 'rate', message: 'חסרה ריבית (עוגן ומרווח)' }
      : { field: 'rate', message: 'הריבית המשוקללת חייבת להיות גדולה מאפס' })
  }
  const t = termIssue(d.term_months)
  if (t) issues.push(t)
  return issues
}

export function loanIssues(d: LoanDraft): DraftIssue[] {
  const issues: DraftIssue[] = []
  const p = principalIssue(d.principal)
  if (p) issues.push(p)
  if (d.repayment_type === 'monthly_fixed') {
    if (loanDraftRate(d) <= 0) {
      const anchored = d.track_type === 'prime' || d.track_type === 'variable'
      const empty = anchored ? (!d.prime_rate && !d.margin) : !d.annual_rate
      issues.push(empty
        ? { field: 'rate', message: anchored ? 'חסרה ריבית (עוגן ומרווח)' : 'חסרה ריבית' }
        : { field: 'rate', message: 'הריבית חייבת להיות גדולה מאפס' })
    }
    const t = termIssue(d.term_months)
    if (t) issues.push(t)
  }
  return issues
}

/** The issue messages joined for compact one-line display (cards, dialog rows). */
export const issueText = (issues: DraftIssue[]) => issues.map(i => i.message).join(' · ')

// "Has data" tests only RAW typed fields — never the grey-placeholder rate
// defaults — so an untouched auto-open form is skipped silently, while a
// half-filled one blocks (no fabrication).
export function trackDraftHasData(d: TrackDraft): boolean {
  return (parseFloat(d.principal) || 0) > 0 || !!d.annual_rate || !!d.prime_rate || !!d.margin || !!d.term_months
}

export function loanDraftHasData(d: LoanDraft): boolean {
  return (parseFloat(d.principal) || 0) > 0 || !!d.annual_rate || !!d.prime_rate || !!d.margin || !!d.term_months
}

/** Grace months as saved to the DB: clamped below the term so the stored value
 *  matches what the schedule engine will actually do (EDGE-12 in lib/mortgage —
 *  grace ≥ term would otherwise display one thing and amortize another). */
export function clampGraceMonths(graceRaw: string, termRaw: string): number {
  const term = parseInt(termRaw, 10) || 360
  const grace = parseInt(graceRaw, 10) || 0
  return Math.min(Math.max(0, grace), Math.max(0, term - 1))
}
