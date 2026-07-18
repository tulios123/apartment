import { trackSchedule } from './mortgage'
import { loanPaymentForMonth, loanSplitForMonth } from './loans'
import { monthEndISO, todayISO, parseLocalISO, monthDayISO } from './format'
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
  /** Spitzer principal/interest split of `amount` — only set for mortgage/loan rows. */
  principal?: number
  interest?: number
}

/** Returns the contract active at asOf (defaults to now). */
export function activeContract<T extends { start_date: string; end_date: string }>(
  contracts: T[],
  asOf: Date = new Date()
): T | undefined {
  // Compare as LOCAL date strings so start/end are inclusive whole days. Instant
  // comparison (new Date('YYYY-MM-DD') is UTC midnight) skews by the UTC offset at the
  // day boundary in Israel — a lease would read inactive on its own start/end date.
  const d = monthDayISO(asOf)   // SW-08: shared local Y-M-D helper
  return contracts.find(c => c.start_date <= d && c.end_date >= d)
}

/** Total rent received across all contracts from each start_date up to asOf. */
export function rentReceivedToDate(contracts: Contract[], asOf: Date = new Date()): number {
  // N6: ONE apartment ⇒ at most ONE rent payment per calendar month. Overlapping
  // contract rows (the old lease's tail overlapping the new lease's start — common
  // when a renewal is entered loosely) used to double-count those months. Walk each
  // contract's due payments and dedup by calendar month; when two contracts claim
  // the same month, the LATER-STARTING one (the newer lease) wins.
  const byMonth = new Map<number, { startMs: number; rent: number }>()
  for (const c of contracts) {
    // EDGE-03: LOCAL parse, consistent with the rest of the date math.
    const start = parseLocalISO(c.start_date)
    const cap = new Date(Math.min(parseLocalISO(c.end_date).getTime(), asOf.getTime()))
    if (cap < start) continue
    // Count rent payments actually due: one per month-anniversary of the start day that
    // has occurred by `cap`. A flat "+1" over-counted a mid-month lease — e.g. 15/1/26→14/1/27
    // spans 13 calendar months but is only 12 payments — so add the final month only once
    // its payment day (the start's day-of-month) has been reached.
    const monthsSpan = (cap.getFullYear() - start.getFullYear()) * 12 + (cap.getMonth() - start.getMonth())
    const months = monthsSpan + (cap.getDate() >= start.getDate() ? 1 : 0)
    for (let i = 0; i < months; i++) {
      const monthIdx = start.getFullYear() * 12 + start.getMonth() + i // calendar month of payment i
      const cur = byMonth.get(monthIdx)
      if (!cur || start.getTime() > cur.startMs) {
        byMonth.set(monthIdx, { startMs: start.getTime(), rent: Number(c.monthly_rent) || 0 })
      }
    }
  }
  let total = 0
  for (const v of byMonth.values()) total += v.rent
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
          amount: Number(c.monthly_rent) || 0,   // numeric col → string at runtime; coerce before it reaches a + sum
          date: monthStart,
          category: RENT_CATEGORIES[0],
          description: c.company_name,
        })
      }
    }

    let mortgageTotal = 0
    let mortgagePrincipal = 0
    let mortgageInterest = 0
    let mortgageDate = monthStart
    for (const t of tracks) {
      const row = trackSchedule(t).find(r => r.date.slice(0, 7) === monthStr)
      if (row) { mortgageTotal += row.payment; mortgagePrincipal += row.principal; mortgageInterest += row.interest; mortgageDate = row.date }
    }
    if (mortgageTotal > 0) {
      entries.push({
        id: `v-mort-${monthStr}`,
        direction: 'expense',
        amount: mortgageTotal,
        date: mortgageDate,
        category: MORTGAGE_CATEGORIES[0],
        description: 'תשלום משכנתא',
        principal: mortgagePrincipal,
        interest: mortgageInterest,
      })
    }

    for (const l of loans) {
      const p = loanPaymentForMonth(l, monthStr)
      if (p) {
        const split = loanSplitForMonth(l, monthStr)
        entries.push({
          id: `v-loan-${l.id}-${monthStr}`,
          direction: 'expense',
          amount: p.amount,
          date: p.date,
          category: 'הלוואה',
          description: l.label || l.lender || 'תשלום הלוואה',
          principal: split?.principal,
          interest: split?.interest,
        })
      }
    }

    // Insurance: one forecast row for the month's active policies (A5 — this makes the
    // Home forecast and the Finances ledger use the same fixed-expense set, so the two
    // screens' month totals reconcile exactly).
    const insTotal = policies.reduce((s, p) => {
      const active = (!p.start_date || p.start_date <= monthEnd) && (!p.end_date || p.end_date >= monthStart)
      return s + (active ? (Number(p.monthly_premium) || 0) : 0)   // numeric col → string; coerce before summing
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
