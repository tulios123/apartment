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
  // EDGE-12: clamp grace below the term so there is always ≥1 amortizing month.
  // grace ≥ term would make effectiveTerm ≤ 0 → payment 0 → a schedule whose balance
  // never reaches zero (a never-amortizing loan). EDGE-13: a net-negative rate
  // (e.g. an over-large "prime minus" margin) is floored to 0 so the math stays sane.
  const grace = Math.min(Math.max(0, graceMonths), Math.max(0, termMonths - 1))
  const effectiveTerm = termMonths - grace
  if (effectiveTerm <= 0 || principal <= 0) return 0
  const r = Math.max(0, annualRate) / 100 / 12
  if (r === 0) return principal / effectiveTerm
  const f = Math.pow(1 + r, effectiveTerm)
  return (principal * r * f) / (f - 1)
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  // Local Y-M-D — NOT toISOString (UTC), which rolls back a day in timezones
  // ahead of UTC and would misattribute a 1st-of-month payment to the prior month.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Full month-by-month schedule for a single track, including any grace period. */
export function trackSchedule(track: MortgageTrack): ScheduleRow[] {
  const { principal, annual_rate, term_months, start_date } = track
  if (term_months <= 0 || principal <= 0) return []
  // EDGE-12/13: clamp grace below the term (always ≥1 amortizing month) and floor a
  // net-negative rate to 0, so the schedule always reaches a zero balance.
  const grace_months = Math.min(Math.max(0, track.grace_months ?? 0), Math.max(0, term_months - 1))
  const r = Math.max(0, annual_rate) / 100 / 12
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

/**
 * Combined schedule across all tracks.
 * Cashflows (payment/interest/principal) sum only the tracks that actually pay on
 * that date. Balance is the TOTAL outstanding across every track as of that date —
 * computed by carrying each track's most recent balance forward — so tracks with
 * different start dates or term lengths don't drop out of the combined balance.
 */
export function combineSchedules(tracks: MortgageTrack[]): ScheduleRow[] {
  const schedules = tracks.map(trackSchedule)
  const dates = [...new Set(schedules.flat().map(r => r.date))].sort((a, b) => a.localeCompare(b))

  return dates.map((date, i) => {
    let payment = 0, interest = 0, principal = 0, balance = 0
    schedules.forEach((rows, ti) => {
      const row = rows.find(r => r.date === date)
      if (row) { payment += row.payment; interest += row.interest; principal += row.principal }
      // Carry-forward outstanding balance for this track as of `date`:
      // 0 before the track starts, its principal until the first payment, then the latest row balance.
      if (tracks[ti].start_date <= date) {
        let bal = Number(tracks[ti].principal) || 0   // numeric col → string; coerce so the carry-forward adds (not concatenates)
        for (const r of rows) {
          if (r.date <= date) bal = r.balance
          else break
        }
        balance += bal
      }
    })
    return { monthIndex: i + 1, date, payment, interest, principal, balance }
  })
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
    const r = Math.max(0, t.annual_rate) / 100 / 12   // EDGE-13: floor negative rate
    return s + ((t.grace_months ?? 0) > 0
      ? t.principal * r
      : monthlyPayment(t.principal, t.annual_rate, t.term_months, 0))
  }, 0)
}

/** Total interest accrued across all tracks up to and including asOf. */
export function interestToDate(tracks: MortgageTrack[], asOf: Date = new Date()): number {
  // LOCAL Y-M-D cutoff — NOT toISOString (UTC), which rolls back a day in timezones
  // ahead of UTC (Israel) and would drop a payment row dated "today" from the total.
  const cutoff = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}-${String(asOf.getDate()).padStart(2, '0')}`
  let sum = 0
  for (const t of tracks) {
    for (const row of trackSchedule(t)) {
      if (row.date <= cutoff) sum += row.interest
    }
  }
  return sum
}
