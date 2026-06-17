import type { Loan } from '../types'

/** Whole months elapsed from start up to and including asOf (0 before/at start). */
export function monthsElapsed(startDate: string | null, asOf: Date = new Date()): number {
  if (!startDate) return 0
  const start = new Date(startDate + 'T00:00:00')
  const months =
    (asOf.getFullYear() - start.getFullYear()) * 12 +
    (asOf.getMonth() - start.getMonth())
  return Math.max(0, months)
}

/**
 * Outstanding balance of a loan as of `asOf`.
 * - monthly_fixed: straight-line — principal shrinks proportionally to the months
 *   remaining out of the full term (no interest/Shpitzer breakdown).
 * - balloon: principal stays outstanding until repaid on sale.
 */
export function loanBalance(loan: Loan, asOf: Date = new Date()): number {
  if (loan.repayment_type === 'balloon') return loan.principal
  const term = loan.term_months ?? 0
  if (term <= 0) return loan.principal
  const elapsed = Math.min(term, monthsElapsed(loan.start_date, asOf))
  return Math.max(0, loan.principal * (term - elapsed) / term)
}

/** Whole months of repayment remaining for a monthly_fixed loan (0 for balloon). */
export function monthsRemaining(loan: Loan, asOf: Date = new Date()): number {
  if (loan.repayment_type !== 'monthly_fixed') return 0
  const term = loan.term_months ?? 0
  return Math.max(0, term - monthsElapsed(loan.start_date, asOf))
}

/** End date (ISO yyyy-mm-dd) of a monthly_fixed loan, or null if not derivable. */
export function loanEndDate(loan: Loan): string | null {
  if (loan.repayment_type !== 'monthly_fixed' || !loan.start_date || !loan.term_months) return null
  const d = new Date(loan.start_date + 'T00:00:00')
  d.setMonth(d.getMonth() + loan.term_months)
  return d.toISOString().slice(0, 10)
}
