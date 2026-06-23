import { extractText, getDocumentProxy } from 'npm:unpdf'

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
    const { fileBase64, mediaType } = await req.json()

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const isPdf = mediaType === 'application/pdf'

    // Cheap path: text-layer PDFs → send TEXT to Haiku (no page-image tokens).
    // Scanned PDFs / images → Sonnet vision.
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
    console.error('extract-rental error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
