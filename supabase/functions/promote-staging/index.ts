import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isAdminEmail } from '../_shared/admin.ts'

// "פרסם לכולם" — publishes EVERYTHING currently in staging to production. Admin-only. To avoid
// needing a widened PAT (Actions:write for workflow_dispatch), it uses the same LABEL trick as
// the merge button: it labels a fresh "promote" issue with `promote-now` (the existing
// Issues-scoped GITHUB_PAT can do that), which fires promote.yml (on: issues labeled). That
// workflow merges staging→main (prod auto-deploys), dispatches deploy.yml, flips every
// in_staging item → fixed, and closes the issue. Works for bot fixes AND manual staging changes.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), GITHUB_REPO (owner/name),
//      FEEDBACK_ADMIN_EMAIL(S), GITHUB_PAT (Issues r/w on the repo).

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
const PROMOTE_LABEL = 'promote-now'

function gh(path: string, method: string, pat: string, body?: unknown) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'apartment-feedback-pipeline',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Admin only (the owner OR the staging management account).
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    if (!caller?.user || !isAdminEmail(caller.user.email)) {
      return json({ error: 'unauthorized' }, 401)
    }

    // How many feedback fixes ride along — for the reply only; NOT a gate (a pure code change
    // with no in_staging item is still promotable; promote.yml no-ops if staging == main).
    const { count } = await supabase
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_staging')

    const pat = Deno.env.get('GITHUB_PAT')
    if (!pat) return json({ error: 'GITHUB_PAT not configured' }, 500)

    // Ensure the label exists (idempotent — 422 = already there).
    await gh('/labels', 'POST', pat, { name: PROMOTE_LABEL, color: '1f6feb', description: 'Publish staging → production' })
      .catch(() => {})

    // Create a promote-request issue WITH the label → fires promote.yml (issues: labeled).
    const issueRes = await gh('/issues', 'POST', pat, {
      title: '🚀 פרסום staging → production',
      body: 'פרסום כל מה שנבדק ב-staging אל production (הופעל מכפתור "פרסם לכולם"). promote.yml ימזג, יפרוס, ויסגור.',
      labels: [PROMOTE_LABEL],
    })
    if (!issueRes.ok) {
      const detail = await issueRes.text()
      console.error('promote label-issue failed:', issueRes.status, detail)
      return json({ error: `הפעלת הפרסום נכשלה (${issueRes.status}). אפשר לפרסם ידנית בגיטהאב.` }, 502)
    }

    return json({ ok: true, promoting: count ?? 0 })
  } catch (e) {
    console.error('promote-staging error:', e)
    return json({ error: String(e) }, 500)
  }
})
