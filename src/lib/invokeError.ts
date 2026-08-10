import { userErrorMessage } from './errorHe'

// A Supabase Edge Function that rejects with a 4xx returns a JSON body `{ error: "<msg>" }`
// where <msg> is already a plain-Hebrew, show-as-is reason (see supabase/functions/_shared/
// validate.ts — 400 bad input, 429 rate-limit). But supabase-js's functions.invoke() only
// hands back a generic FunctionsHttpError; the real message lives on `error.context`, the
// raw Response. This digs it out so the user sees the SPECIFIC reason ("הקובץ גדול מדי",
// "חרגתם ממכסת הסריקות") instead of a blanket "try again".
//
// Falls back to userErrorMessage(error, fallback) when there is no server body — e.g. a
// network failure (offline) or a 500 with no `error` field — so the caller's Hebrew
// fallback (or the network hint) still shows, never a raw English exception.
export async function invokeErrorMessage(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response } | null)?.context
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json()
      const msg = body?.error
      // Only trust a non-empty Hebrew string — a bare code or English blob falls through
      // to the generic mapping rather than surfacing jargon to a family member.
      if (typeof msg === 'string' && msg.trim() && /[א-ת]/.test(msg)) return msg
    }
  } catch { /* body already consumed / not JSON — fall through to the generic mapping */ }
  return userErrorMessage(error, fallback)
}
