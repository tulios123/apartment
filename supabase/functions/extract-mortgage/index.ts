import { parseAndValidateFiles, guardRequestSize, errorResponse } from '../_shared/validate.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cap/validate the input before touching the paid Anthropic API. Multiple files
    // (e.g. several bank-app screenshots of one mortgage) arrive as { files: [...] };
    // a single { fileBase64, mediaType } stays supported.
    guardRequestSize(req)
    const body = await req.json()
    const files = parseAndValidateFiles(body)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const contentBlocks = files.map(f => f.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: f.mediaType, data: f.fileBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.fileBase64 } })

    const prompt = `You are reading an Israeli bank mortgage approval/confirmation document (it may be a
scanned monospaced printout, and may be split across several images, e.g. bank-app screenshots —
read them all together as one document). Extract the borrower's FULL mortgage composition — every
track (מסלול / מַשְׁנֶה) — and return ONLY a valid JSON object, no markdown:

{
  "tracks": [
    {
      "track_type": "prime | fixed_unlinked | fixed_linked | variable",
      "principal": integer ₪ amount of THIS track,
      "annual_rate": nominal annual interest rate, percent number (e.g. 4.6),
      "prime_rate": the anchor/base rate (prime or מק"מ) percent for prime & variable, else null,
      "margin": spread over the anchor, percent — negative for "מינוס"/הפחתה (prime & variable), else null,
      "term_months": total repayment period in months (integer),
      "grace_months": leading interest-only months (גרייס), else 0
    }
  ]
}

CRITICAL rules for these documents:
1. SOURCE OF TRUTH = the loan-conditions table (often titled "תנאי ההלואה ופירוט התשלומים"
   inside "נספח א"), which lists every numbered loan (מס׳/משנה 1,2,3…). Use THAT table for the
   tracks — NOT the credit/disbursement screens ("זיכוי", "סכום הזיכוי"), which show only the
   amount transferred on one date and would undercount the mortgage.
2. ONE track per loan number. A loan may span TWO rows: a leading interest-only period then the
   amortizing period (e.g. 24 rows then 336 rows). When a loan has two rows, term_months = the
   SUM of the two payment counts, and grace_months = the FIRST (smaller) count. This applies to
   EVERY loan that has two rows, whatever its track type. A loan with a single row has
   grace_months = 0 and term_months = that count. Read the exact payment counts from the scan —
   distinguish e.g. 23 from 24.
3. track_type — use BOTH of these together:
   (a) STRUCTURAL signal from the conditions table: a loan row that has an anchor ("שיעור העוגן")
       and/or a margin ("תוספת/הפחתה") is NEVER fixed — it is prime or variable. A loan with NO
       anchor and NO margin is fixed.
   (b) The description table ("תאור ההלואה"), keyed by the same loan number, via its "אפיון" text:
       "ריבית קבועה לא צמודה" → fixed_unlinked
       "ריבית קבועה צמודה"    → fixed_linked
       "פריים" (פריים-קרן…)   → prime
       "ריבית משתנה" / "עוגן מק\"מ" / "משתנה כל X" → variable
   When (a) and (b) agree, you are done. If a loan has an anchor whose value is close to the prime
   rate (~5.5–6%) it is prime; an anchor of ~3–4% (מק"מ) with a "משתנה" description is variable.
   Cross-reference EACH loan number between the two tables — do not default everything to fixed.
   Several loans can share the same אפיון and therefore the same track_type (e.g. TWO separate
   "עוגן מק\"מ" variable loans). Read every loan's own אפיון line and give it that type; a loan
   described "משתנה"/"עוגן מק\"מ" is ALWAYS variable (never fixed), and its anchor is the ~3–4%
   value in its own עוגן column — not the 5.5% prime used by the prime loans.
4. annual_rate = the plain "ריבית" column (nominal). If there is also a "ריבית מתואמת"
   (adjusted/effective) column, do NOT use it for annual_rate.
5. For prime & variable: prime_rate = the "שיעור העוגן" (anchor BASE) value — the larger number,
   typically 3–6% (prime ≈ 5–6%, מק"מ/makam ≈ 3–4%). margin = the small "תוספת/הפחתה" spread —
   typically under 1.5% — keeping its sign (+ adds, − / הפחתה subtracts). The anchor is almost
   always LARGER than the margin; do NOT swap them. Sanity: annual_rate ≈ prime_rate + margin.
6. Extract ALL loans in the conditions table, even if some were disbursed on different dates.

Return an empty "tracks" array only if no loan-conditions table exists.`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Sonnet + extended thinking reliably reads these scanned, multi-section bank printouts.
        // Calibrated against a real נספח א: plain Haiku/Sonnet wobbled on the variable מק"מ tracks;
        // Sonnet+thinking (4k budget) + the deterministic anchor/margin guard below = stable 5/5
        // across runs, ~4× cheaper and faster than Opus. Runs once per user at onboarding.
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        thinking: { type: 'enabled', budget_tokens: 4000 },
        messages: [{ role: 'user', content: [...contentBlocks, { type: 'text', text: prompt }] }],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Anthropic error: ${err}`)
    }

    const data = await resp.json()
    // With extended thinking, content[0] is a thinking block — grab the text block, not [0].
    const text: string = data.content?.find((b: { type: string; text?: string }) => b.type === 'text')?.text ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const result = match ? JSON.parse(match[0]) : { tracks: [] }

    // Deterministic guard: for prime/variable tracks the anchor (prime ~5–6% or מק"מ ~3–4%) is
    // always larger than the spread (<~1.5%). If the model swapped them, swap back — this fixes
    // the one residual failure mode and makes the cheaper model reliable.
    if (Array.isArray(result.tracks)) {
      result.tracks = result.tracks.map((t: Record<string, unknown>) => {
        const pr = Number(t.prime_rate), mg = Number(t.margin)
        if ((t.track_type === 'prime' || t.track_type === 'variable') &&
            t.prime_rate != null && t.margin != null && Math.abs(mg) > Math.abs(pr)) {
          return { ...t, prime_rate: t.margin, margin: t.prime_rate }
        }
        return t
      })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('extract-mortgage error:', e)
    return errorResponse(e, corsHeaders)
  }
})
