export type PremiumFreq = 'monthly' | 'yearly'

/**
 * Insurance premiums are stored monthly (the app is monthly-centric), but a user
 * commonly enters a yearly figure. Toggling the unit must be lossless: entering
 * 1000/year then flipping monthly↔yearly must return 1000 — not drift to 996.
 *
 * The drift bug came from round-tripping through a *rounded* monthly value:
 * 1000 /12 → round(83.33)=83 → 83*12 = 996. The cure is to keep the exact
 * (possibly fractional) monthly premium as the single source of truth and round
 * only for display, so `displayAmount(toMonthly(1000,'yearly'),'yearly') === 1000`.
 */

/** Exact monthly premium from a value typed in the given unit (may be fractional). */
export function toMonthly(amount: number, freq: PremiumFreq): number {
  return freq === 'yearly' ? amount / 12 : amount
}

/** Whole-number amount to show in the input for a unit, from the exact monthly base. */
export function displayAmount(monthly: number, freq: PremiumFreq): number {
  return Math.round(freq === 'yearly' ? monthly * 12 : monthly)
}
