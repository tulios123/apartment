import type { TrackDraft, LoanDraft, PolicyDraft } from './types'

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

// ── Soft plausibility warnings (never block saving) ───────────────────────────
// Legal-but-suspicious values get a quiet heads-up: the classic slip is typing
// YEARS into the months field (a "30-month" million-shekel mortgage), or a rate
// an order of magnitude off. The user stays free to save — the app just asks.

export function trackWarnings(d: TrackDraft): string[] {
  const w: string[] = []
  const term = parseInt(d.term_months, 10) || 0
  if (term >= 1 && term <= 40) {
    w.push(`תקופה של ${term} חודשים נדירה למשכנתא — אם התכוונתם לשנים, הזינו ${term * 12} חודשים`)
  }
  const rate = trackEffectiveRate(d)
  if (rate > 15) w.push(`ריבית של ${rate.toFixed(2)}% גבוהה מאוד למשכנתא — כדאי לוודא`)
  if ((parseFloat(d.principal) || 0) > 10_000_000) w.push('הסכום גבוה במיוחד — כדאי לוודא שאין ספרה מיותרת')
  return w
}

export function loanWarnings(d: LoanDraft): string[] {
  const w: string[] = []
  if (d.repayment_type !== 'monthly_fixed') return w
  const rate = loanDraftRate(d)
  if (rate > 20) w.push(`ריבית של ${rate.toFixed(2)}% גבוהה מאוד להלוואה — כדאי לוודא`)
  if ((parseFloat(d.principal) || 0) > 10_000_000) w.push('הסכום גבוה במיוחד — כדאי לוודא שאין ספרה מיותרת')
  return w
}

// ── Insurance policy ──────────────────────────────────────────────────────────

/** A policy is worth saving only with a company name or a real (positive)
 *  premium — a typed "0" alone is not data (also enforced at finish). */
export function policyHasData(p: PolicyDraft): boolean {
  return p.company.trim() !== '' || (parseFloat(p.monthly_premium) || 0) > 0
}

export type PolicyIssue = { field: 'content' | 'dates'; message: string }

export function policyIssues(p: PolicyDraft): PolicyIssue[] {
  const issues: PolicyIssue[] = []
  if (!policyHasData(p)) issues.push({ field: 'content', message: 'כדי לשמור פוליסה צריך שם חברה או פרמיה' })
  // ISO strings — string compare is correct. An inverted coverage window is invalid.
  if (p.start_date && p.end_date && p.end_date < p.start_date) {
    issues.push({ field: 'dates', message: 'סיום הכיסוי לפני תחילת הכיסוי' })
  }
  return issues
}

/** Home/life premiums run tens of shekels a month — a "monthly" premium in the
 *  hundreds usually means the YEARLY figure was typed into monthly mode. */
export function premiumLooksYearly(monthlyPremium: number): boolean {
  return monthlyPremium > 400
}

// ── Rental ────────────────────────────────────────────────────────────────────

export type RentalIssue = { field: 'endDate' | 'rent'; message: string }
type RentalDraft = { companyName: string; startDate: string; endDate: string; monthlyRent: string }

export function rentalIssues(v: RentalDraft): RentalIssue[] {
  const issues: RentalIssue[] = []
  if (v.startDate && v.endDate && v.endDate < v.startDate) {
    issues.push({ field: 'endDate', message: 'תאריך הסיום לפני תאריך ההתחלה' })
  }
  if (v.monthlyRent !== '' && (parseFloat(v.monthlyRent) || 0) <= 0) {
    issues.push({ field: 'rent', message: 'שכר הדירה חייב להיות גדול מאפס' })
  }
  return issues
}

/** Which of the four contract essentials are still empty — shown as a quiet
 *  heads-up once the user typed ANYTHING, so a half-filled rental never comes
 *  as a surprise at finish. Empty when untouched or complete. */
export function rentalGaps(v: RentalDraft): string[] {
  const hasAny = !!(v.companyName.trim() || v.startDate || v.endDate || v.monthlyRent)
  if (!hasAny) return []
  const gaps: string[] = []
  if (!v.companyName.trim()) gaps.push('שם השוכר')
  if (!v.startDate) gaps.push('תאריך התחלה')
  if (!v.endDate) gaps.push('תאריך סיום')
  if ((parseFloat(v.monthlyRent) || 0) <= 0) gaps.push('שכר דירה')
  return gaps.length === 4 ? [] : gaps   // one field typed then cleared → nothing to nag about
}

export function rentalWarnings(v: RentalDraft): string[] {
  const rent = parseFloat(v.monthlyRent) || 0
  return rent > 50_000 ? ['שכר דירה גבוה מאוד — כדאי לוודא שאין ספרה מיותרת'] : []
}

// ── Purchase ──────────────────────────────────────────────────────────────────

type PurchaseDraft = { purchasePrice: string; signingDate: string; keyDeliveryDate: string }

export function purchaseWarnings(v: PurchaseDraft): string[] {
  const w: string[] = []
  const price = parseFloat(v.purchasePrice) || 0
  if (price > 0 && price < 100_000) w.push('מחיר הרכישה נמוך מאוד — ודאו שהוזן בשקלים מלאים (למשל 1,090,000 ולא 1,090)')
  if (price > 20_000_000) w.push('מחיר הרכישה גבוה במיוחד — כדאי לוודא שאין ספרה מיותרת')
  if (v.signingDate && v.keyDeliveryDate && v.keyDeliveryDate < v.signingDate) {
    w.push('מסירת המפתח לפני תאריך חתימת החוזה — כדאי לוודא את התאריכים')
  }
  return w
}

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
