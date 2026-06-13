import type { MortgageTrack } from '../types'

export interface ScheduleRow {
  monthIndex: number
  date: string        // ISO yyyy-mm-dd
  payment: number
  interest: number
  principal: number
  balance: number     // remaining after this payment
}

/**
 * Shpitzer equal monthly payment for the post-grace amortization period.
 * annualRate is PERCENT (5.25 → 5.25%). graceMonths is subtracted from termMonths.
 */
export function monthlyPayment(principal: number, annualRate: number, termMonths: number, graceMonths = 0): number {
  const effectiveTerm = termMonths - graceMonths
  if (effectiveTerm <= 0 || principal <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return principal / effectiveTerm
  const f = Math.pow(1 + r, effectiveTerm)
  return (principal * r * f) / (f - 1)
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** Full month-by-month schedule for a single track, including any grace period. */
export function trackSchedule(track: MortgageTrack): ScheduleRow[] {
  const { principal, annual_rate, term_months, start_date, grace_months = 0 } = track
  if (term_months <= 0 || principal <= 0) return []
  const r = annual_rate / 100 / 12
  // Post-grace Shpitzer payment (on full principal for remaining term)
  const postGracePay = monthlyPayment(principal, annual_rate, term_months, grace_months)
  const rows: ScheduleRow[] = []
  let balance = principal
  for (let i = 1; i <= term_months; i++) {
    const interest = r === 0 ? 0 : balance * r
    let prin: number
    let payment: number
    if (i <= grace_months) {
      // Grace: interest only, no principal repayment
      prin = 0
      payment = interest
    } else {
      prin = postGracePay - interest
      if (i === term_months) prin = balance   // absorb rounding drift
      payment = interest + prin
    }
    balance = Math.max(0, balance - prin)
    rows.push({
      monthIndex: i,
      date: addMonths(start_date, i),
      payment,
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

/**
 * Combined monthly payment across all tracks during the grace period.
 * Tracks with grace_months > 0 pay interest-only; others pay full Shpitzer.
 * Returns 0 when no track has a grace period.
 */
export function gracePeriodPayment(tracks: MortgageTrack[]): number {
  const hasGrace = tracks.some(t => (t.grace_months ?? 0) > 0)
  if (!hasGrace) return 0
  return tracks.reduce((s, t) => {
    const r = t.annual_rate / 100 / 12
    return s + ((t.grace_months ?? 0) > 0
      ? t.principal * r
      : monthlyPayment(t.principal, t.annual_rate, t.term_months, 0))
  }, 0)
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
