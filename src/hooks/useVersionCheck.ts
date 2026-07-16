import { useSyncExternalStore } from 'react'
import { BUILD_ID, fetchDeployedBuildId } from '../lib/version'

// Module-level singleton so the banner and the account-menu line share ONE poller
// (not one per mount). Flips to true once the deployed build id differs from ours.
let updateAvailable = false
let started = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

async function check() {
  if (updateAvailable) return // once known, no need to keep asking
  const deployed = await fetchDeployedBuildId()
  if (deployed && deployed !== BUILD_ID) {
    updateAvailable = true
    emit()
  }
}

function start() {
  if (started) return
  started = true
  check()
  // Re-check when the app is brought back to the foreground (the moment the owner
  // returns to an installed PWA that may have gone stale), and on a slow background timer.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.setInterval(check, 5 * 60 * 1000)
}

/**
 * `updateAvailable` — a newer deploy exists than the running bundle. `buildId` — the
 * running build's id. `recheck` — force an immediate check (for a "check now" affordance).
 */
export function useVersionCheck(): { updateAvailable: boolean; buildId: string; recheck: () => void } {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      start()
      return () => listeners.delete(cb)
    },
    () => updateAvailable,
    () => false,
  )
  return { updateAvailable: value, buildId: BUILD_ID, recheck: check }
}
