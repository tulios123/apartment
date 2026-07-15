import { extractText, getDocumentProxy } from 'npm:unpdf'
import { parseAndValidateFiles, guardRequestSize, errorResponse } from '../_shared/validate.ts'
import { enforceExtractRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const prompt = `This is an Israeli real estate purchase contract (חוזה רכישה / חוזה מכר).
Extract these fields and return ONLY a valid JSON object — no markdown, no explanation:

{
  "buyerName": "full name of the buyer/purchaser (הרוכש/הקונה), or null",
  "street": "street name and house number of the PROPERTY BEING PURCHASED only (רחוב ומספר בית של הדירה הנמכרת) — WITHOUT the city, or null",
  "city": "the city/locality where the PROPERTY BEING PURCHASED physically sits (עיר/יישוב הדירה הנמכרת). CRITICAL: this is NOT (a) the buyer's home town / mailing address (מען/כתובת הקונה/הרוכש), NOT (b) the city of the Land Registry office (לשכת רישום המקרקעין / לשכת רישום בעיר X — e.g. 'לשכת רישום המקרקעין בבאר שבע' does NOT mean the property is in Beer Sheva; that office serves a whole region), and NOT (c) the city of a court, notary, lawyer's office or seller. Take it ONLY from the description of the property itself (the הואיל clauses / מהות הממכר / the address of the apartment). If the property's city is not explicitly stated next to the apartment's address (e.g. only Gush/Helka is given), return null — do NOT guess from any office/registry/party address.",
  "propertyAddress": "full address of the purchased property as 'street and number, city' (fallback only), or null",
  "blockParcel": "Gush and Helka (גוש וחלקה), e.g. 'גוש 6660 חלקה 84', or null",
  "purchasePrice": numeric purchase price (מחיר הרכישה/התמורה) as integer, or null. Do NOT use an existing mortgage/loan payoff amount (יתרה לסילוק) as the price,
  "purchaseDate": "signing/purchase date in YYYY-MM-DD format, or null",
  "keyDeliveryDate": "key delivery / possession date (תאריך מסירת המפתח / יום המסירה) in YYYY-MM-DD format, or null",
  "propertySizeSqm": numeric built area of the apartment itself in square meters (שטח הדירה במ\"ר — look in the property description / מפרט / טאבו) — NOT land/plot/garden/balcony/shared area, or null,
  "floor": floor number as integer (קומה), or null,
  "rooms": number of rooms (מספר חדרים — look for 'X חדרים' in the property description), may be a half (e.g. 4.5), or null
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
    await enforceExtractRateLimit(req, 'extract-contract')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    // Cheap path: a SINGLE text-layer PDF → send its text to Haiku (no page-image
    // tokens, cheapest model). Multiple files / scans / images → Sonnet vision over
    // all of them (Haiku can't OCR Hebrew).
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
    console.error('extract-contract error:', e)
    return errorResponse(e, corsHeaders)
  }
})
