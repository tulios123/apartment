import { trackSchedule } from './mortgage'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from './constants'
import type { Contract, MortgageTrack } from '../types'

export interface VirtualEntry {
  id: string
  direction: 'income' | 'expense'
  amount: number
  date: string
  category: string
  description: string
}

/** Total rent received across all contracts from each start_date up to asOf. */
export function rentReceivedToDate(contracts: Contract[], asOf: Date = new Date()): number {
  let total = 0
  for (const c of contracts) {
    const start = new Date(c.start_date)
    const cap = new Date(Math.min(new Date(c.end_date).getTime(), asOf.getTime()))
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
 * When month is undefined, generates rows for all elapsed months of the year.
 */
export function monthlyVirtualEntries(
  contracts: Contract[],
  tracks: MortgageTrack[],
  year: number,
  month?: number,
): VirtualEntry[] {
  const todayStr = new Date().toISOString().slice(0, 10)

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
    const monthEnd = new Date(year, m, 0).toISOString().slice(0, 10)

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
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date))
}
