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

/**
 * The date a payment falls due, given the lease's own payment day and a calendar month.
 * Clamped to the month's length so a lease paid on the 31st is due on the 30th in April
 * (and on the 28th/29th in February) rather than silently rolling into the next month.
 */
function dueDateISO(year: number, monthIdx0: number, day: number): string {
  const lastDay = new Date(year, monthIdx0 + 1, 0).getDate()
  return monthDayISO(new Date(year, monthIdx0, Math.min(day, lastDay)))
}

/**
 * Rent cannot be collected on an apartment that has not been handed over.
 *
 * A lease is routinely signed — and dated to start — before the keys arrive: that is the
 * normal shape of a purchase with a sitting tenant or an agreed move-in. The app used to
 * count rent from the lease's start date alone, so a buyer still waiting for handover was
 * shown income he had not received (Omer, notes 11+16: ₪22,500 of rent on an apartment
 * that was not yet his). The rule the owner approved on 21.09: a rent payment counts only
 * if it falls due ON or AFTER the key-delivery date.
 *
 * Passing no handover (or one already past) leaves every existing calculation identical —
 * which is deliberate: nobody who already holds keys sees a number move.
 */
function rentDue(dueISO: string, handover?: string | null): boolean {
  return !handover || dueISO >= handover
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
export function rentReceivedToDate(
  contracts: Contract[],
  asOf: Date = new Date(),
  handover?: string | null,
): number {
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
      // Nothing is collected before the keys change hands, however the lease is dated.
      if (!rentDue(dueDateISO(Math.floor(monthIdx / 12), monthIdx % 12, start.getDate()), handover)) continue
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
  /** The property's key-delivery date. Rent before it is not forecast — see `rentDue`. */
  handover?: string | null,
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

    // R7: ONE apartment ⇒ at most ONE projected rent row per calendar month.
    // Overlapping contract rows (an old lease's tail under a new lease's start)
    // used to project BOTH rents into the ledger and the month forecast. Mirror
    // rentReceivedToDate's N6 rule: the LATER-STARTING (newer) lease wins.
    let rentContract: Contract | null = null
    for (const c of contracts) {
      if (c.start_date <= monthEnd && c.end_date >= monthStart) {
        if (!rentContract || c.start_date > rentContract.start_date) rentContract = c
      }
    }
    // The same handover gate `rentReceivedToDate` applies, computed the same way (the
    // lease's own payment day inside this month) so the forecast and the received total
    // never disagree about which month rent starts in.
    const rentPayable = rentContract && rentDue(
      dueDateISO(year, m - 1, Number(rentContract.start_date.slice(8, 10)) || 1),
      handover,
    )
    if (rentContract && rentPayable) {
      entries.push({
        id: `v-rent-${rentContract.id}-${monthStr}`,
        direction: 'income',
        amount: Number(rentContract.monthly_rent) || 0,   // numeric col → string at runtime; coerce before it reaches a + sum
        date: monthStart,
        category: RENT_CATEGORIES[0],
        description: rentContract.company_name,
      })
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
