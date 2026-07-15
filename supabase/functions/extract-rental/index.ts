import { extractText, getDocumentProxy } from 'npm:unpdf'
import { parseAndValidateFiles, guardRequestSize, errorResponse } from '../_shared/validate.ts'
import { enforceExtractRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const prompt = `This is an Israeli residential rental agreement (חוזה שכירות / הסכם שכירות).
Extract these fields and return ONLY a valid JSON object — no markdown, no explanation:

{
  "tenantName": "name of the tenant or company renting the property (השוכר), or null",
  "startDate": "lease start date (תחילת השכירות) in YYYY-MM-DD format, or null",
  "endDate": "lease end date (סיום השכירות) in YYYY-MM-DD format, or null",
  "monthlyRent": numeric monthly rent (דמי השכירות החודשיים) as integer in ₪, or null,
  "paymentMethod": "check" if rent is paid by post-dated checks (צ'קים/שיקים/המחאות), else "bank_transfer" if by bank transfer/standing order (העברה בנקאית/הוראת קבע), else null,
  "paymentDay": day of month the rent is due (היום בחודש לתשלום / ז.פ) as integer 1-28, or null
}

Use null for any field not clearly stated in the document.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cap/validate the input before touching the paid Anthropic API. Multiple files
    // (e.g. several screenshots) arrive as { files: [...] }; a single
    // { fileBase64, mediaType } stays supported.
    guardRequestSize(req)
    const body = await req.json()
    const files = parseAndValidateFiles(body)
    // Per-owner rolling-hour budget on the billed Anthropic calls (429 if exceeded).
    await enforceExtractRateLimit(req, 'extract-rental')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    // Cheap path: a SINGLE text-layer PDF → send its text to Haiku (no page-image
    // tokens). Multiple files / scans / images → Sonnet vision over all of them.
    let docText = ''
    if (files.length === 1 && files[0].mediaType === 'application/pdf') {
      try {
        const bytes = Uint8Array.from(atob(files[0].fileBase64), c => c.charCodeAt(0))
        const pdf = await getDocumentProxy(bytes)
        const r = await extractText(pdf, { mergePages: true })
        docText = (typeof r.text === 'string' ? r.text : (r.text ?? []).join('\n')).trim()
      } catch { docText = '' }
    }
    const useText = docText.length > 300

    const model = useText ? 'claude-haiku-4-5' : 'claude-sonnet-4-6'
    const content = useText
      ? [{ type: 'text', text: `${prompt}\n\n--- DOCUMENT TEXT ---\n${docText}` }]
      : [
          ...files.map(f => f.mediaType === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: f.mediaType, data: f.fileBase64 } }
            : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.fileBase64 } }),
          { type: 'text', text: prompt },
        ]

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Anthropic error: ${err}`)
    }

    const data = await resp.json()
    const text: string = data.content?.find((b: { type: string; text?: string }) => b.type === 'text')?.text ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const result = match ? JSON.parse(match[0]) : {}

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('extract-rental error:', e)
    return errorResponse(e, corsHeaders)
  }
})
