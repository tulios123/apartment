import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Seamless fix-preview login. Mints a one-time magic-link token for the ADMIN's OWN account
// so the per-fix Cloudflare preview (a separate origin) can open already logged in as the
// owner, on live data, with no re-login. Admin-only. The token is single-use + short-lived;
// the console passes it to the preview in the URL fragment (never sent to a server), and the
// preview redeems it with verifyOtp then scrubs it from the URL (see src/lib/previewAuth.ts).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), FEEDBACK_ADMIN_EMAIL.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Admin only — mint a login token for the caller's own (owner) account, never anyone else.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    const adminEmail = (Deno.env.get('FEEDBACK_ADMIN_EMAIL') ?? 'itai.shubi@gmail.com').toLowerCase()
    const email = caller?.user?.email
    if (!caller?.user || email?.toLowerCase() !== adminEmail) {
      return json({ error: 'unauthorized' }, 401)
    }

    // generateLink (admin) creates the token WITHOUT sending an email. We return only the
    // hashed_token — the preview verifies it via supabase.auth.verifyOtp on load.
    const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: email! })
    const tokenHash = data?.properties?.hashed_token
    if (error || !tokenHash) {
      console.error('preview-auth generateLink failed:', error)
      return json({ error: 'link generation failed' }, 500)
    }

    return json({ token_hash: tokenHash })
  } catch (e) {
    console.error('preview-auth error:', e)
    return json({ error: String(e) }, 500)
  }
})
