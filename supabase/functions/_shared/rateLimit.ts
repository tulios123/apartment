// Per-owner rolling-hour rate limit for the paid extract-* edge functions.
//
// Input hardening (size/format caps) lives in validate.ts. This adds the other
// abuse dimension: *volume*. Every extract-* call is a billed Anthropic request,
// so a signed-in family member could run up the bill with a tight upload loop.
// We cap each owner to MAX_EXTRACTS_PER_HOUR across all four functions and return
// a clear Hebrew 429 (via RateLimitError → errorResponse) once exhausted.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RateLimitError } from './validate.ts'

// Generous for real use — a full onboarding reads ~4 documents — but tight enough
// to stop a runaway loop from racking up cost. Shared across all extract-* functions.
export const MAX_EXTRACTS_PER_HOUR = 20
const WINDOW_MS = 60 * 60 * 1000

// The owner id (auth.uid()) from the caller's JWT. These functions are deployed
// WITH JWT verification, so the platform gateway already validated the token before
// we run — the `sub` claim is trustworthy without re-verifying the signature here.
export function ownerFromJwt(req: Request): string | null {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    // base64url → base64 before decoding.
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

// Enforce the per-owner budget. Throws RateLimitError (→ HTTP 429) when exhausted.
// Uses the service role (RLS-bypassing) because extract_usage has no client policy.
//
// Failure philosophy: we FAIL OPEN on our own infra faults (missing service key,
// count error) — a real user must never be blocked from reading their document by
// our hiccup. We FAIL CLOSED only when the caller can't be identified at all (no
// JWT sub), which shouldn't happen given upstream verification.
export async function enforceExtractRateLimit(req: Request, fn: string): Promise<void> {
  const owner = ownerFromJwt(req)
  if (!owner) {
    throw new RateLimitError('לא ניתן לאמת את המשתמש — התחברו מחדש ונסו שוב.')
  }

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return   // not configured → don't block the user

  const supabase = createClient(url, key)
  const since = new Date(Date.now() - WINDOW_MS).toISOString()

  const { count, error } = await supabase
    .from('extract_usage')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', owner)
    .gte('called_at', since)
  if (error) return   // counting failed → fail open, don't punish the user

  if ((count ?? 0) >= MAX_EXTRACTS_PER_HOUR) {
    throw new RateLimitError('הגעתם למכסת עיבוד המסמכים לשעה — נסו שוב עוד כמה דקות.')
  }

  // Record this call, then best-effort prune this owner's rows older than the window
  // so the table stays bounded without a scheduled job. Neither insert nor prune is
  // fatal to the request — a failure here just means the next call counts one fewer.
  await supabase.from('extract_usage').insert({ owner_id: owner, fn })
  await supabase.from('extract_usage').delete().eq('owner_id', owner).lt('called_at', since)
}
