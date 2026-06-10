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

    const prompt = `This is an Israeli real estate purchase contract (חוזה רכישה / חוזה מכר).
Extract these fields and return ONLY a valid JSON object — no markdown, no explanation:

{
  "buyerName": "full name of the buyer/purchaser (הרוכש/הקונה), or null",
  "propertyAddress": "full address of the property (כתובת הנכס), or null",
  "blockParcel": "Gush and Helka (גוש וחלקה), e.g. 'גוש 6660 חלקה 84', or null",
  "purchasePrice": numeric purchase price (מחיר הרכישה/התמורה) as integer, or null,
  "purchaseDate": "signing/purchase date in YYYY-MM-DD format, or null",
  "keyDeliveryDate": "key delivery / possession date (תאריך מסירת המפתח / יום המסירה) in YYYY-MM-DD format, or null",
  "propertySizeSqm": numeric size in square meters (שטח הנכס) as number, or null,
  "floor": floor number as integer (קומה), or null
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
        model: 'claude-haiku-4-5',
        max_tokens: 512,
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
