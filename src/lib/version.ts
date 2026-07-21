// Human-readable app version, shown in the staging top bar so the owner can confirm
// at a glance WHICH build the testing app is running (past any stale PWA cache).
// BUMP THIS with every fix/change that gets pushed — the number is meaningless unless
// it moves. Format: MAJOR.MINOR.PATCH; bump PATCH per fix, MINOR per feature batch.
export const APP_VERSION = '1.1.2'

// The build id/timestamp baked into THIS bundle at build time (see vite.config.ts).
// `typeof` guard so a stray non-defined environment can't throw a ReferenceError.
export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
export const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''

/**
 * The build id of the CURRENTLY-DEPLOYED bundle, read from /version.json with the cache
 * bypassed. Returns null on any failure (offline, dev server without the file) so callers
 * treat "unknown" as "no update" rather than nagging. The `?t=` param + no-store defeats
 * any intermediate/PWA cache so we always see the live deploy.
 */
export async function fetchDeployedBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.buildId === 'string' ? data.buildId : null
  } catch {
    return null
  }
}
