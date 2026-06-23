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

    const prompt = `This is an Israeli mortgage document — an approval-in-principle (אישור עקרוני),
amortization schedule (לוח סילוקין), or mortgage-mix summary (תמהיל משכנתא). Extract every
track (מסלול) in the mix. Return ONLY a valid JSON object — no markdown, no explanation:

{
  "tracks": [
    {
      "track_type": "prime | fixed_unlinked | fixed_linked | variable",
      "principal": numeric track amount in ₪ as an integer,
      "annual_rate": effective annual interest rate as a percent number (e.g. 5.1),
      "prime_rate": prime/anchor component as a percent (prime & variable only), else null,
      "margin": margin/spread as a percent — CAN be negative ("פריים מינוס") (prime & variable only), else null,
      "term_months": repayment period in months (years × 12) as an integer,
      "grace_months": interest-only months (גרייס) as an integer, or 0
    }
  ]
}

track_type mapping from Hebrew:
- "prime" ← פריים
- "fixed_unlinked" ← קבועה לא צמודה (ק"ל / קל"צ)
- "fixed_linked" ← קבועה צמודה (ק"צ)
- "variable" ← משתנה / משתנה צמודה / משתנה כל 5 שנים
For prime & variable: annual_rate = prime_rate + margin. For fixed tracks: prime_rate and
margin are null and annual_rate is the stated fixed rate.
Use null or 0 for anything not clearly stated. Return an empty "tracks" array if none are found.`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Anthropic error: ${err}`)
    }

    const data = await resp.json()
    const text: string = data.content?.[0]?.text ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const result = match ? JSON.parse(match[0]) : { tracks: [] }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('extract-mortgage error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
