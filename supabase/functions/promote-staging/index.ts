import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isAdminEmail } from '../_shared/admin.ts'

// "פרסם לכולם" — publishes everything currently in staging to production. Admin-only. It
// triggers the promote.yml workflow (workflow_dispatch); that workflow merges staging→main
// (production auto-deploys off main) and then flips every in_staging item → fixed. Returns
// immediately — the owner watches the items flip via the console poll / a push.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), GITHUB_REPO (owner/name),
//      FEEDBACK_ADMIN_EMAIL(S), GITHUB_PAT_PROMOTE (fine-grained, Actions: read/write).

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

const REPO = Deno.env.get('GITHUB_REPO') ?? 'tulios123/apartment'
const WORKFLOW = 'promote.yml'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Admin only (owner OR the staging test account).
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    if (!caller?.user || !isAdminEmail(caller.user.email)) {
      return json({ error: 'unauthorized' }, 401)
    }

    // Nothing to promote? Tell the caller so the UI can say so instead of firing a no-op run.
    const { count } = await supabase
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_staging')
    if (!count || count === 0) {
      return json({ error: 'אין כרגע תיקונים בסביבת־הבדיקות לפרסום.' }, 409)
    }

    const pat = Deno.env.get('GITHUB_PAT_PROMOTE')
    if (!pat) return json({ error: 'GITHUB_PAT_PROMOTE not configured' }, 500)

    // workflow_dispatch on promote.yml (which lives on main). Needs Actions: write on the PAT.
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'apartment-feedback-pipeline',
        },
        body: JSON.stringify({ ref: 'main' }),
      },
    )
    if (!res.ok) {
      const detail = await res.text()
      console.error('promote dispatch failed:', res.status, detail)
      return json({ error: `הפעלת הפרסום נכשלה (${res.status}). בדקו את הטוקן/ההרשאות.` }, 502)
    }

    return json({ ok: true, promoting: count })
  } catch (e) {
    console.error('promote-staging error:', e)
    return json({ error: String(e) }, 500)
  }
})
