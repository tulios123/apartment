// D25 (UX run 19.07): failure paths used to surface raw exception text — a family
// member saw "TypeError: Failed to fetch" as the save-failure message. Map the
// technical shapes to plain Hebrew that states the problem and the way out;
// anything unrecognized falls back to the caller's Hebrew message (never the
// raw English text).
const NETWORK_HINTS = ['failed to fetch', 'load failed', 'networkerror', 'network request failed', 'connection', 'timeout', 'timed out']
// A write refused by row-level security. Since migration 052 the likeliest reason by far
// is that this account is a viewer on the apartment — and the raw text ("new row violates
// row-level security policy") tells a family member nothing at all. The client hides what
// a viewer cannot do, but hiding a button is a courtesy: this is what is seen when one
// is missed, and it has to name the reason rather than look like a fault.
const DENIED_HINTS = ['row-level security', 'row level security', 'violates row', 'permission denied', '42501']

export function userErrorMessage(e: unknown, fallback: string): string {
  const raw = (e instanceof Error ? e.message : typeof e === 'string' ? e : '') || ''
  const lower = raw.toLowerCase()
  if (NETWORK_HINTS.some(h => lower.includes(h))) {
    return 'אין חיבור לאינטרנט כרגע — בדקו את החיבור ונסו שוב. מה שהזנתם נשמר על המסך.'
  }
  if (DENIED_HINTS.some(h => lower.includes(h))) {
    return 'יש לך גישת צפייה בלבד בדירה הזו, אז אי אפשר לשמור. מי ששיתף אותך יכול לשנות את זה בהגדרות.'
  }
  // A Hebrew message from our own code is already user-facing — pass it through.
  if (/[א-ת]/.test(raw)) return raw
  return fallback
}
