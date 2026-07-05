import { trackSchedule } from './mortgage'
import { loanPaymentForMonth } from './loans'
import { monthEndISO, todayISO, parseLocalISO } from './format'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from './constants'
import type { Contract, MortgageTrack, Loan } from '../types'

/** Number of months elapsed between startStr and endStr (or now if endStr is null/future). */
export function elapsedMonths(startStr: string | null, endStr: string | null): number {
  if (!startStr) return 0
  // EDGE-03: parse stored dates as LOCAL (mirrors mortgage.ts/loans.ts), not UTC,
  // so month boundaries don't skew for runtimes behind UTC.
  const start = parseLocalISO(startStr)
  const end = endStr ? new Date(Math.min(parseLocalISO(endStr).getTime(), Date.now())) : new Date()
  if (end <= start) return 0
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}

/** Total insurance premiums paid to date across all policies. */
export function insurancePaidToDate(
  policies: { monthly_premium: number | null; start_date: string | null; end_date: string | null }[]
): number {
  return policies.reduce((s, p) =>
    s + (p.monthly_premium ?? 0) * elapsedMonths(p.start_date, p.end_date), 0)
}

export interface VirtualEntry {
  id: string
  direction: 'income' | 'expense'
  amount: number
  date: string
  category: string
  description: string
}

/** Returns the contract active at asOf (defaults to now). */
export function activeContract<T extends { start_date: string; end_date: string }>(
  contracts: T[],
  asOf: Date = new Date()
): T | undefined {
  // Compare as LOCAL date strings so start/end are inclusive whole days. Instant
  // comparison (new Date('YYYY-MM-DD') is UTC midnight) skews by the UTC offset at the
  // day boundary in Israel — a lease would read inactive on its own start/end date.
  const d = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}-${String(asOf.getDate()).padStart(2, '0')}`
  return contracts.find(c => c.start_date <= d && c.end_date >= d)
}

/** Total rent received across all contracts from each start_date up to asOf. */
export function rentReceivedToDate(contracts: Contract[], asOf: Date = new Date()): number {
  let total = 0
  for (const c of contracts) {
    // EDGE-03: LOCAL parse, consistent with the rest of the date math.
    const start = parseLocalISO(c.start_date)
    const cap = new Date(Math.min(parseLocalISO(c.end_date).getTime(), asOf.getTime()))
    if (cap < start) continue
    const months = (cap.getFullYear() - start.getFullYear()) * 12 + (cap.getMonth() - start.getMonth()) + 1
    total += Math.max(0, months) * c.monthly_rent
  }
  return total
}

/** Total mortgage payments made across all tracks up to and including todayStr. */
export function mortgagePaidToDate(tracks: MortgageTrack[], todayStr: string): number {
  let total = 0
  for (const t of tracks) {
    for (const row of trackSchedule(t)) {
      if (row.date <= todayStr) total += row.payment
      else break
    }
  }
  return total
}

/**
 * Computed "virtual" ledger rows for a given year (and optionally month).
 * - One rent income row per active contract per month.
 * - One combined mortgage expense row (all tracks summed) per month.
 * - One expense row per monthly_fixed loan per month it is active.
 * When month is undefined, generates rows for all elapsed months of the year.
 */
export function monthlyVirtualEntries(
  contracts: Contract[],
  tracks: MortgageTrack[],
  year: number,
  month?: number,
  loans: Loan[] = [],
  policies: { monthly_premium: number | null; start_date: string | null; end_date: string | null }[] = [],
): VirtualEntry[] {
  const todayStr = todayISO() // LOCAL date — not toISOString (UTC rolls back a day)

  const months = month
    ? [month]
    : Array.from({ length: 12 }, (_, i) => i + 1).filter(m =>
        `${year}-${String(m).padStart(2, '0')}-01` <= todayStr
      )

  const entries: VirtualEntry[] = []

  for (const m of months) {
    const monthPad = String(m).padStart(2, '0')
    const monthStr = `${year}-${monthPad}`
    const monthStart = `${monthStr}-01`
    const monthEnd = monthEndISO(year, m)

    for (const c of contracts) {
      if (c.start_date <= monthEnd && c.end_date >= monthStart) {
        entries.push({
          id: `v-rent-${c.id}-${monthStr}`,
          direction: 'income',
          amount: c.monthly_rent,
          date: monthStart,
          category: RENT_CATEGORIES[0],
          description: c.company_name,
        })
      }
    }

    let mortgageTotal = 0
    let mortgageDate = monthStart
    for (const t of tracks) {
      const row = trackSchedule(t).find(r => r.date.slice(0, 7) === monthStr)
      if (row) { mortgageTotal += row.payment; mortgageDate = row.date }
    }
    if (mortgageTotal > 0) {
      entries.push({
        id: `v-mort-${monthStr}`,
        direction: 'expense',
        amount: mortgageTotal,
        date: mortgageDate,
        category: MORTGAGE_CATEGORIES[0],
        description: 'תשלום משכנתא',
      })
    }

    for (const l of loans) {
      const p = loanPaymentForMonth(l, monthStr)
      if (p) {
        entries.push({
          id: `v-loan-${l.id}-${monthStr}`,
          direction: 'expense',
          amount: p.amount,
          date: p.date,
          category: 'הלוואה',
          description: l.label || l.lender || 'תשלום הלוואה',
        })
      }
    }

    // Insurance: one forecast row for the month's active policies (A5 — this makes the
    // Home forecast and the Finances ledger use the same fixed-expense set, so the two
    // screens' month totals reconcile exactly).
    const insTotal = policies.reduce((s, p) => {
      const active = (!p.start_date || p.start_date <= monthEnd) && (!p.end_date || p.end_date >= monthStart)
      return s + (active ? (p.monthly_premium ?? 0) : 0)
    }, 0)
    if (insTotal > 0) {
      entries.push({
        id: `v-ins-${monthStr}`,
        direction: 'expense',
        amount: insTotal,
        date: monthStart,
        category: 'ביטוח',
        description: 'ביטוח',
      })
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date))
}
