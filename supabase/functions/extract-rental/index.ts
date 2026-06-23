const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fileBase64, mediaType } = await req.json()

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const isPdf = mediaType === 'application/pdf'
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }

    const prompt = `This is an Israeli residential rental agreement (חוזה שכירות / הסכם שכירות).
Extract these fields and return ONLY a valid JSON object — no markdown, no explanation:

{
  "tenantName": "name of the tenant or company renting the property (השוכר), or null",
  "startDate": "lease start date (תחילת השכירות) in YYYY-MM-DD format, or null",
  "endDate": "lease end date (סיום השכירות) in YYYY-MM-DD format, or null",
  "monthlyRent": numeric monthly rent (דמי השכירות החודשיים) as integer in ₪, or null,
  "paymentMethod": "check" if rent is paid by post-dated checks (צ'קים/שיקים/המחאות), else "bank_transfer" if by bank transfer/standing order (העברה בנקאית/הוראת קבע), else null,
  "paymentDay": day of month the rent is due (היום בחודש לתשלום) as integer 1-28, or null
}

Use null for any field not clearly stated in the document.`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Flat field extraction — Sonnet is plenty; no extended thinking needed.
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
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
