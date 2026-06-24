import type { MortgageTrack, Loan } from '../types'
import { trackSchedule } from './mortgage'
import { loanSplitForMonth } from './loans'

/**
 * The Spitzer decomposition of a month's payments into the part that builds
 * equity (principal) and the part that is the cost of money (interest), summed
 * across all amortizing vehicles. Balloon loans never contribute (no payment).
 * Pure read-only consumption of the existing schedules — no new math.
 */
export interface PaymentSplit {
  /** Principal repaid this month — money converted into ownership. */
  principal: number
  /** Interest paid this month — the bank's fee. */
  interest: number
  /** principal + interest. */
  total: number
}

function ym(d: Date): string {
  // LOCAL YYYY-MM — toISOString is UTC and returns the previous month for the first
  // hours of the 1st in timezones ahead of UTC (Israel), shifting "this month".
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shift(asOf: Date, monthsAhead: number): Date {
  const d = new Date(asOf)
  d.setMonth(d.getMonth() + monthsAhead)
  return d
}

/** Summed principal/interest split for a specific `YYYY-MM` month. */
export function splitForMonth(tracks: MortgageTrack[], monthlyLoans: Loan[], month: string): PaymentSplit {
  let principal = 0
  let interest = 0
  for (const t of tracks) {
    const row = trackSchedule(t).find(r => r.date.slice(0, 7) === month)
    if (row) { principal += row.principal; interest += row.interest }
  }
  for (const l of monthlyLoans) {
    const s = loanSplitForMonth(l, month)
    if (s) { principal += s.principal; interest += s.interest }
  }
  return { principal, interest, total: principal + interest }
}

/**
 * This month's split. If the current calendar month has no scheduled payment
 * (e.g. financing starts in the future), falls back to the first month with a
 * payment within the next year so the accelerator still shows a real figure.
 */
export function currentSplit(tracks: MortgageTrack[], monthlyLoans: Loan[], asOf: Date = new Date()): PaymentSplit {
  const now = splitForMonth(tracks, monthlyLoans, ym(asOf))
  if (now.total > 0) return now
  for (let i = 1; i <= 12; i++) {
    const s = splitForMonth(tracks, monthlyLoans, ym(shift(asOf, i)))
    if (s.total > 0) return s
  }
  return now
}

/** The split `monthsAhead` from now — for the Spitzer trajectory line. */
export function futureSplit(tracks: MortgageTrack[], monthlyLoans: Loan[], monthsAhead: number, asOf: Date = new Date()): PaymentSplit {
  return splitForMonth(tracks, monthlyLoans, ym(shift(asOf, monthsAhead)))
}

/** Total principal repaid over the coming 12 months — annualized equity build. */
export function principalNext12Months(tracks: MortgageTrack[], monthlyLoans: Loan[], asOf: Date = new Date()): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += splitForMonth(tracks, monthlyLoans, ym(shift(asOf, i))).principal
  }
  return sum
}
