// SW-12: latest-wins guard for the data hooks' fetches. Every hook exposes its
// fetch as `refetch`, so a plain cancelled-flag inside the effect can't cover
// manual refetches — instead every invocation takes a ticket, and only the
// LATEST invocation may commit state. This closes both races: a stale response
// overwriting a newer month's data (fast month-switching), and setState after
// the screen unmounted (invalidate() from the effect cleanup).
export function latestOnly() {
  let current = 0
  return {
    /** Begin an invocation. Returns a probe: true while this is still the latest. */
    start(): () => boolean {
      const ticket = ++current
      return () => ticket === current
    },
    /** Kill all in-flight invocations (call from the effect cleanup / unmount). */
    invalidate(): void {
      current++
    },
  }
}
