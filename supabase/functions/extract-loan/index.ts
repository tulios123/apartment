const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    // Accept multiple files (e.g. several screenshots of one loan) via { files: [...] };
    // keep back-compat with a single { fileBase64, mediaType }.
    const files: { fileBase64: string; mediaType: string }[] =
      Array.isArray(body.files) && body.files.length
        ? body.files
        : [{ fileBase64: body.fileBase64, mediaType: body.mediaType }]

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const contentBlocks = files.map(f => f.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: f.mediaType, data: f.fileBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.fileBase64 } })

    const prompt = `You are reading a document or screenshot describing one or more personal/supplementary
loans (הלוואה) — e.g. a bank-app loan screen, a loan repayment schedule, or a family-loan agreement.
These are NOT the main property mortgage. Extract every loan and return ONLY a valid JSON object,
no markdown:

{
  "loans": [
    {
      "lender": "name of the lender / bank / person (המלווה), or null",
      "principal": integer ₪ original loan amount (סכום ההלוואה / קרן),
      "annual_rate": nominal annual interest rate as a percent number (e.g. 6.5), or null if interest-free,
      "term_months": total repayment period in months as an integer, or null,
      "grace_months": leading interest-only months (גרייס) if any, else 0,
      "start_date": "the loan start / origination date (תאריך תחילת ההלוואה / מתן ההלוואה / ההעמדה) in YYYY-MM-DD format, or null",
      "repayment_type": "monthly_fixed" for a normal amortizing loan repaid in monthly instalments, or "balloon" for a loan repaid in one lump sum at the end / on sale (בלון / בוליט / נפרעת במכירה)
    }
  ]
}

Rules:
- If the loan is interest-free and repaid in a single payment later, repayment_type = "balloon",
  annual_rate = null and term_months = null.
- annual_rate is the nominal YEARLY rate — not the monthly rate and not the total interest amount.
- Use null for any field not clearly stated. Return an empty "loans" array if no loan is shown.`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // A personal-loan screen is far simpler than the mortgage נספח א, so plain Sonnet
        // (no extended thinking) is enough and cheaper/faster.
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: [...contentBlocks, { type: 'text', text: prompt }] }],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Anthropic error: ${err}`)
    }

    const data = await resp.json()
    const text: string = data.content?.find((b: { type: string; text?: string }) => b.type === 'text')?.text ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const result = match ? JSON.parse(match[0]) : { loans: [] }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('extract-loan error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
