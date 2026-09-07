// Where the owner stands in the life of the apartment.
//
// The app was built around ONE clock — the monthly cycle (rent in, fixed payments out,
// close the month, repeat) — and every pillar serves it. A buyer who has signed but not
// yet taken delivery has no monthly cycle at all, so screens built on that clock read as
// empty or wrong for them. See docs/specs/onboarding.md.
//
// The stage is DERIVED, never stored. Two consequences we rely on:
//  1. It flips by itself the day the key-delivery date passes — no transition machinery.
//  2. Every existing owner reads as `in_hand`, so nobody's behaviour changes on deploy.
//     That direction is deliberate: only an explicitly entered, still-future date counts
//     as waiting. A blank or past date means the place is yours.

export type Possession = 'awaiting_key' | 'in_hand'

/** Lease state, independent of possession — the two can and do combine (a signed lease
 *  starting on handover day is normal). */
export type LeaseStatus =
  | 'leased'     // a lease covers today
  | 'signed'     // a lease exists but hasn't started yet
  | 'searching'  // no lease now, but there was one before — between tenants
  | 'none'       // never had a lease

/**
 * Does the owner hold the keys?
 *
 * `todayISO` is passed in rather than read here so this stays pure and testable, and so
 * callers use the app's Israel-local date helper (never toISOString().slice — see
 * src/lib/format).
 */
export function possession(keyDeliveryDate: string | null | undefined, todayISO: string): Possession {
  return keyDeliveryDate && keyDeliveryDate > todayISO ? 'awaiting_key' : 'in_hand'
}

/** Lease state across every contract on the account. */
export function leaseStatus(
  contracts: { start_date: string; end_date: string }[],
  todayISO: string,
): LeaseStatus {
  if (contracts.length === 0) return 'none'
  if (contracts.some((c) => c.start_date <= todayISO && c.end_date >= todayISO)) return 'leased'
  if (contracts.some((c) => c.start_date > todayISO)) return 'signed'
  return 'searching'
}
