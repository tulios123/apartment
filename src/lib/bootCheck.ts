// The boot-time "does this account have a property?" probe (C3 in App.tsx).
// supabase-js returns API failures as `{ error }`, but a NETWORK-level failure
// (offline boot, reset connection) REJECTS the promise — which used to escape
// the retry/backoff guard entirely and trap the user on an infinite splash.
// This wrapper folds both failure shapes into one 'error' result so the caller's
// retry ladder sees every kind of failure (AUD-011).
//
// timeoutMs (owner decision 18.07): supabase-js retries internally for ~7s per
// call on a dead network, which stretched the ladder to ~38s before the manual
// retry screen. Capping each probe keeps the whole ladder around ten seconds —
// a probe that answers later than the cap is treated as errored (the ladder
// retries anyway, and the manual "נסו שוב" covers a genuinely slow network).
const PROBE_TIMEOUT_MS = 2000

export async function probeHasProperty(
  query: () => PromiseLike<{ data: { id: string }[] | null; error: unknown }>,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<boolean | 'error'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), timeoutMs) })
    const result = await Promise.race([Promise.resolve(query()).then(r => r), timeout])
    if (result === 'timeout') return 'error'
    const { data, error } = result
    if (error) return 'error'
    return (data?.length ?? 0) > 0
  } catch {
    return 'error'
  } finally {
    clearTimeout(timer)
  }
}
