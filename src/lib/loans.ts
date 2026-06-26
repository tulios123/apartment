import type { Loan } from '../types'
import { monthlyPayment } from './mortgage'

/** Whole months elapsed from start up to and including asOf (0 before/at start). */
export function monthsElapsed(startDate: string | null, asOf: Date = new Date()): number {
  if (!startDate) return 0
  const start = new Date(startDate + 'T00:00:00')
  const months =
    (asOf.getFullYear() - start.getFullYear()) * 12 +
    (asOf.getMonth() - start.getMonth())
  return Math.max(0, months)
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  // Local Y-M-D — NOT toISOString (UTC), which rolls back a day in timezones
  // ahead of UTC and would misattribute a 1st-of-month payment to the prior month.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** LOCAL Y-M-D — never toISOString (UTC rolls back a day in timezones ahead of UTC,
 * which would drop a payment dated "today" from balance/interest totals). */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface LoanRow {
  date: string
  interest: number
  principal: number
  balance: number
}

/**
 * Month-by-month Shpitzer schedule for a monthly_fixed loan (empty for balloon).
 * Internal — we never render this; it only feeds balance/interest calculations.
 */
function loanSchedule(loan: Loan): LoanRow[] {
  if (loan.repayment_type !== 'monthly_fixed') return []
  const principal = loan.principal
  const rate = Math.max(0, loan.annual_rate ?? 0)            // EDGE-13: floor negative rate
  const term = loan.term_months ?? 0
  // EDGE-12: clamp grace below the term so the loan always amortizes to zero.
  const grace = Math.min(Math.max(0, loan.grace_months ?? 0), Math.max(0, term - 1))
  const start = loan.start_date
  if (principal <= 0 || term <= 0 || !start) return []
  const r = rate / 100 / 12
  // Post-grace Shpitzer payment (amortizes the full principal over the remaining term).
  const pay = monthlyPayment(principal, rate, term, grace)
  const rows: LoanRow[] = []
  let balance = principal
  for (let i = 1; i <= term; i++) {
    const interest = r === 0 ? 0 : balance * r
    let prin: number
    if (i <= grace) {
      prin = 0 // grace: interest-only, no principal repayment
    } else {
      prin = pay - interest
      if (i === term) prin = balance // absorb rounding drift
    }
    balance = Math.max(0, balance - prin)
    rows.push({ date: addMonths(start, i), interest, principal: prin, balance })
  }
  return rows
}

/**
 * Outstanding balance as of `asOf`.
 * - balloon: principal stays outstanding until repaid on sale.
 * - monthly_fixed: Shpitzer balance carried forward to the latest paid month.
 */
export function loanBalance(loan: Loan, asOf: Date = new Date()): number {
  if (loan.repayment_type === 'balloon') return loan.principal
  const rows = loanSchedule(loan)
  if (rows.length === 0) return loan.principal
  const cutoff = localISO(asOf)
  let balance = loan.principal
  for (const row of rows) {
    if (row.date <= cutoff) balance = row.balance
    else break
  }
  return balance
}

/** Derived (never shown) Shpitzer monthly payment; 0 for balloon. */
export function loanMonthlyPayment(loan: Loan): number {
  if (loan.repayment_type !== 'monthly_fixed') return 0
  return monthlyPayment(loan.principal, loan.annual_rate ?? 0, loan.term_months ?? 0, loan.grace_months ?? 0)
}

/**
 * The Shpitzer payment due in a given `YYYY-MM` month (interest + principal,
 * absorbing last-month rounding). Returns null for balloon loans or months
 * outside the repayment schedule — feeds the cash-flow forecast.
 */
export function loanPaymentForMonth(loan: Loan, monthStr: string): { amount: number; date: string } | null {
  if (loan.repayment_type !== 'monthly_fixed') return null
  const row = loanSchedule(loan).find(r => r.date.slice(0, 7) === monthStr)
  return row ? { amount: row.interest + row.principal, date: row.date } : null
}

/**
 * Principal/interest split of the Shpitzer payment falling in a given `YYYY-MM`
 * month. Returns null for balloon loans or months outside the schedule.
 * Feeds the Wealth "accelerator" equity-vs-interest breakdown.
 */
export function loanSplitForMonth(loan: Loan, monthStr: string): { principal: number; interest: number } | null {
  if (loan.repayment_type !== 'monthly_fixed') return null
  const row = loanSchedule(loan).find(r => r.date.slice(0, 7) === monthStr)
  return row ? { principal: row.principal, interest: row.interest } : null
}

/** Interest accrued up to and including asOf — feeds investment interest expenses. */
export function loanInterestToDate(loan: Loan, asOf: Date = new Date()): number {
  const cutoff = localISO(asOf)
  return loanSchedule(loan).reduce((s, row) => (row.date <= cutoff ? s + row.interest : s), 0)
}

/** Total interest over the life of the loan. */
export function loanTotalInterest(loan: Loan): number {
  return loanSchedule(loan).reduce((s, row) => s + row.interest, 0)
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
  return addMonths(loan.start_date, loan.term_months)
}
