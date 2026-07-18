// Synchronous re-entry guard for async actions triggered by taps. React's
// disabled={busy} closes the door only after a re-render, so a ghost double-tap
// (two clicks in the same event-loop tick) enters the handler twice — the exact
// hole the onboarding finish plugged with finishingRef, extracted here so other
// money-writing actions (e.g. approve-rent) share one tested definition.
export function reentryGuard() {
  let inFlight = false
  return {
    /** Try to enter the guarded section. False = a run is already in flight. */
    enter(): boolean {
      if (inFlight) return false
      inFlight = true
      return true
    },
    /** Leave the guarded section (call from finally). */
    exit(): void {
      inFlight = false
    },
  }
}
