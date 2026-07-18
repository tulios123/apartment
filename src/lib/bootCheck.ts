// The boot-time "does this account have a property?" probe (C3 in App.tsx).
// supabase-js returns API failures as `{ error }`, but a NETWORK-level failure
// (offline boot, reset connection) REJECTS the promise — which used to escape
// the retry/backoff guard entirely and trap the user on an infinite splash.
// This wrapper folds both failure shapes into one 'error' result so the caller's
// retry ladder sees every kind of failure (AUD-011).
export async function probeHasProperty(
  query: () => PromiseLike<{ data: { id: string }[] | null; error: unknown }>,
): Promise<boolean | 'error'> {
  try {
    const { data, error } = await query()
    if (error) return 'error'
    return (data?.length ?? 0) > 0
  } catch {
    return 'error'
  }
}
