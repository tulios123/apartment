import { supabase } from './supabase'

// Shared AI extraction for financing documents (mortgage statements, loan docs),
// reused by the liabilities editor. Content-addressed localStorage cache keyed by the
// file bytes — the SAME keys the onboarding wizard uses — so re-scanning a document
// that was already read (here or in onboarding) is free and never re-charges the model.

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

// FNV-1a 32-bit over the base64 — different bytes → different key → a fresh call.
// Identical to the onboarding hash so the cache is shared.
function hashString(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

async function extractCached<T>(fnName: string, cachePrefix: string, files: File[]): Promise<T> {
  const payload = await Promise.all(
    files.map(async (f) => ({ fileBase64: await fileToBase64(f), mediaType: f.type })),
  )
  const cacheKey = `${cachePrefix}_${hashString(payload.map((p) => p.fileBase64).join(''))}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) as T } catch { /* corrupt → re-fetch */ }
  }
  const res = await supabase.functions.invoke(fnName, { body: { files: payload } })
  if (res.error) throw res.error
  try { localStorage.setItem(cacheKey, JSON.stringify(res.data)) } catch { /* quota — skip */ }
  return res.data as T
}

/** Detected mortgage tracks from a bank statement (raw records; caller maps to its form). */
export async function extractMortgageTracks(files: File[]): Promise<Record<string, unknown>[]> {
  const data = await extractCached<{ tracks?: Record<string, unknown>[] }>('extract-mortgage', 'apt_extract_mortgage_v2', files)
  return (data?.tracks ?? []).filter((t) => (Number(t.principal) || 0) > 0)
}

/** Detected loans from a loan document (raw records; caller maps to its form). */
export async function extractLoans(files: File[]): Promise<Record<string, unknown>[]> {
  const data = await extractCached<{ loans?: Record<string, unknown>[] }>('extract-loan', 'apt_extract_loan_v2', files)
  return (data?.loans ?? []).filter((l) => (Number(l.principal) || 0) > 0)
}

/** Detected rental-contract fields from a lease document (raw record; caller maps).
 *  The edge function always returns a full object with `null` for fields it didn't
 *  find, so collapse an all-empty result to null — otherwise the caller can't tell
 *  "read nothing" from "read something" (mirrors the filter in the other extractors). */
export async function extractRental(files: File[]): Promise<Record<string, unknown> | null> {
  const data = await extractCached<Record<string, unknown> | null>('extract-rental', 'apt_extract_rental_v1', files)
  if (!data) return null
  const hasAny = ['tenantName', 'startDate', 'endDate', 'monthlyRent', 'paymentMethod']
    .some((k) => data[k] != null && String(data[k]).trim() !== '')
  return hasAny ? data : null
}
