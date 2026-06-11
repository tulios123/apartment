import type { MortgageTrack } from '../types'

export interface ScheduleRow {
  monthIndex: number
  date: string        // ISO yyyy-mm-dd
  payment: number
  interest: number
  principal: number
  balance: number     // remaining after this payment
}

/** Shpitzer equal monthly payment. annualRate is PERCENT (5.25 → 5.25%). */
export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (termMonths <= 0 || principal <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return principal / termMonths
  const f = Math.pow(1 + r, termMonths)
  return (principal * r * f) / (f - 1)
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** Full month-by-month schedule for a single track. */
export function trackSchedule(track: MortgageTrack): ScheduleRow[] {
  const { principal, annual_rate, term_months, start_date } = track
  if (term_months <= 0 || principal <= 0) return []
  const r = annual_rate / 100 / 12
  const pay = monthlyPayment(principal, annual_rate, term_months)
  const rows: ScheduleRow[] = []
  let balance = principal
  for (let i = 1; i <= term_months; i++) {
    const interest = r === 0 ? 0 : balance * r
    let prin = pay - interest
    if (i === term_months) prin = balance   // absorb rounding drift
    balance = Math.max(0, balance - prin)
    rows.push({
      monthIndex: i,
      date: addMonths(start_date, i),
      payment: interest + prin,
      interest,
      principal: prin,
      balance,
    })
  }
  return rows
}

/** Combined schedule summing all tracks by calendar month. */
export function combineSchedules(tracks: MortgageTrack[]): ScheduleRow[] {
  const byDate = new Map<string, ScheduleRow>()
  for (const track of tracks) {
    for (const row of trackSchedule(track)) {
      const acc = byDate.get(row.date)
      if (acc) {
        acc.payment += row.payment
        acc.interest += row.interest
        acc.principal += row.principal
        acc.balance += row.balance
      } else {
        byDate.set(row.date, { ...row })
      }
    }
  }
  const out = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  out.forEach((row, i) => { row.monthIndex = i + 1 })
  return out
}

/** Total interest accrued across all tracks up to and including asOf. */
export function interestToDate(tracks: MortgageTrack[], asOf: Date = new Date()): number {
  const cutoff = asOf.toISOString().slice(0, 10)
  let sum = 0
  for (const t of tracks) {
    for (const row of trackSchedule(t)) {
      if (row.date <= cutoff) sum += row.interest
    }
  }
  return sum
}
