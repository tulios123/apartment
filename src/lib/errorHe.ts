// D25 (UX run 19.07): failure paths used to surface raw exception text — a family
// member saw "TypeError: Failed to fetch" as the save-failure message. Map the
// technical shapes to plain Hebrew that states the problem and the way out;
// anything unrecognized falls back to the caller's Hebrew message (never the
// raw English text).
const NETWORK_HINTS = ['failed to fetch', 'load failed', 'networkerror', 'network request failed', 'connection', 'timeout', 'timed out']

export function userErrorMessage(e: unknown, fallback: string): string {
  const raw = (e instanceof Error ? e.message : typeof e === 'string' ? e : '') || ''
  const lower = raw.toLowerCase()
  if (NETWORK_HINTS.some(h => lower.includes(h))) {
    return 'אין חיבור לאינטרנט כרגע — בדקו את החיבור ונסו שוב. מה שהזנתם נשמר על המסך.'
  }
  // A Hebrew message from our own code is already user-facing — pass it through.
  if (/[א-ת]/.test(raw)) return raw
  return fallback
}
