// Tiny in-memory stale-while-revalidate store for read hooks.
//
// Every screen's data hooks remount and refetch on each tab switch; with no
// cache that means a fresh round of Supabase round-trips (and a skeleton) every
// time — 2-3s on cellular. Here we keep the last result per query key so a
// revisited screen renders instantly from cache while it refreshes in the
// background. Lives only for the session (cleared on sign-out), so it never
// serves another account's data.

const store = new Map<string, unknown>()

export function readCache<T>(key: string | null | undefined): T | undefined {
  return key ? (store.get(key) as T | undefined) : undefined
}

export function writeCache<T>(key: string | null | undefined, value: T): void {
  if (key) store.set(key, value)
}

export function clearQueryCache(): void {
  store.clear()
}
