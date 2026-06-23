import { extractText, getDocumentProxy } from 'npm:unpdf'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const prompt = `This is an Israeli real estate purchase contract (חוזה רכישה / חוזה מכר).
Extract these fields and return ONLY a valid JSON object — no markdown, no explanation:

{
  "buyerName": "full name of the buyer/purchaser (הרוכש/הקונה), or null",
  "propertyAddress": "full address of the property (כתובת הנכס) as 'street and number, city', or null",
  "blockParcel": "Gush and Helka (גוש וחלקה), e.g. 'גוש 6660 חלקה 84', or null",
  "purchasePrice": numeric purchase price (מחיר הרכישה/התמורה) as integer, or null. Do NOT use an existing mortgage/loan payoff amount (יתרה לסילוק) as the price,
  "purchaseDate": "signing/purchase date in YYYY-MM-DD format, or null",
  "keyDeliveryDate": "key delivery / possession date (תאריך מסירת המפתח / יום המסירה) in YYYY-MM-DD format, or null",
  "propertySizeSqm": numeric size in square meters (שטח הנכס) as number, or null,
  "floor": floor number as integer (קומה), or null,
  "rooms": number of rooms (מספר חדרים), may be a half (e.g. 4.5), or null
}

Use null for any field not clearly stated in the document.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fileBase64, mediaType } = await req.json()

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const isPdf = mediaType === 'application/pdf'

    // Cheap path: if the PDF has a real text layer, send the TEXT to Haiku (no
    // page-image tokens, cheapest model) — accurate for clean digital contracts.
    // Fall back to Sonnet vision for scanned PDFs / images (Haiku can't OCR Hebrew).
    let docText = ''
    if (isPdf) {
      try {
        const bytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0))
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
          isPdf
            ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }
            : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } },
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
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
