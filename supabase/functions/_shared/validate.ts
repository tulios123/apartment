// Shared input validation for the paid extract-* edge functions.
//
// These functions require a valid JWT (enforced by the platform), but a signed-in
// family member could still (a) rack up Anthropic cost with many/large uploads, or
// (b) crash the function with a 500 by sending an odd/oversized/wrong-format file.
// We cap the input and validate media types here, returning a clear Hebrew error
// (HTTP 400) the client can show as-is — instead of a raw 500.

export type ExtractFile = { fileBase64: string; mediaType: string }

// The media types the Anthropic image/document blocks accept. Anything else would
// 500 downstream, so reject it up front with a clear message.
const ALLOWED_MEDIA_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

// Caps. base64 inflates raw bytes by ~4/3, so a 10MB file ≈ 13.4M base64 chars.
// We measure the *decoded* size so a cap means "~this much actual file".
export const MAX_FILE_BYTES = 10 * 1024 * 1024   // 10MB per file
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024  // 25MB across one call
export const MAX_FILES = 10                      // e.g. several bank-app screenshots
// Coarse early guard on the raw HTTP body (base64 + JSON overhead over MAX_TOTAL).
export const MAX_REQUEST_BYTES = 40 * 1024 * 1024

// Decoded byte length of a base64 string, without allocating the decoded buffer.
function base64Bytes(b64: string): number {
  if (!b64) return 0
  const len = b64.length
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((len * 3) / 4) - padding
}

// Distinguishes "the caller sent something invalid" (400) from a real server fault (500).
export class ValidationError extends Error {}

// The caller exceeded their per-hour extract budget (429). Kept here so errorResponse
// can map it, and rateLimit.ts can throw it, without a circular import.
export class RateLimitError extends Error {}

// Cheap pre-parse rejection using Content-Length, so a huge body never gets read
// into memory / parsed. Header may be absent — then we fall through to the precise
// per-file checks after parsing.
export function guardRequestSize(req: Request): void {
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > MAX_REQUEST_BYTES) {
    throw new ValidationError('הבקשה גדולה מדי — שלחו פחות קבצים או קבצים קטנים יותר.')
  }
}

// Normalises the request body into a validated file list, or throws ValidationError
// with a Hebrew message. Accepts { files: [{fileBase64, mediaType}] } and stays
// back-compatible with a single { fileBase64, mediaType }.
export function parseAndValidateFiles(body: unknown): ExtractFile[] {
  const b = (body ?? {}) as Record<string, unknown>
  const rawFiles: unknown =
    Array.isArray(b.files) && b.files.length
      ? b.files
      : [{ fileBase64: b.fileBase64, mediaType: b.mediaType }]

  if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
    throw new ValidationError('לא צורף קובץ — צלמו מחדש או העלו PDF/JPG.')
  }
  if (rawFiles.length > MAX_FILES) {
    throw new ValidationError(`יותר מדי קבצים בבקשה (עד ${MAX_FILES}) — שלחו פחות קבצים בבת אחת.`)
  }

  const files: ExtractFile[] = []
  let total = 0
  for (const f of rawFiles) {
    const file = (f ?? {}) as Record<string, unknown>
    const fileBase64 = file.fileBase64
    const mediaType = file.mediaType
    if (typeof fileBase64 !== 'string' || fileBase64.length === 0) {
      throw new ValidationError('קובץ ריק או פגום — צלמו מחדש או העלו PDF/JPG.')
    }
    if (typeof mediaType !== 'string' || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
      throw new ValidationError('פורמט קובץ לא נתמך — צלמו מחדש או העלו PDF/JPG.')
    }
    const bytes = base64Bytes(fileBase64)
    if (bytes > MAX_FILE_BYTES) {
      throw new ValidationError('הקובץ גדול מדי (עד 10MB) — צלמו באיכות נמוכה יותר או העלו PDF.')
    }
    total += bytes
    files.push({ fileBase64, mediaType })
  }
  if (total > MAX_TOTAL_BYTES) {
    throw new ValidationError('סך הקבצים גדול מדי — שלחו פחות קבצים או קבצים קטנים יותר.')
  }
  return files
}

// Standard error responder — the Hebrew message + matching status:
//   429 rate-limit (RateLimitError), 400 bad input (ValidationError), 500 otherwise
//   (generic message; the real details go to the logs, not the client).
export function errorResponse(e: unknown, corsHeaders: Record<string, string>): Response {
  let status = 500
  let message = 'אירעה שגיאה בעיבוד המסמך. נסו שוב.'
  if (e instanceof RateLimitError) {
    status = 429
    message = e.message
  } else if (e instanceof ValidationError) {
    status = 400
    message = e.message
  }
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
