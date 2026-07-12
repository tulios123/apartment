import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// One-tap "merge & publish" — the owner reviews a ready fix in the console and merges its
// PR without leaving the app. Admin-only. To avoid widening the GITHUB_PAT (which is
// Issues-only), this does NOT call the merge API directly; it labels the PR with
// `claude-merge` (Issues:write is enough to label). That label fires .github/workflows/
// claude-merge.yml, which merges with the built-in GITHUB_TOKEN (contents+PR write). On
// merge, the existing claude-fix-merged.yml callback flips the item to 'fixed'.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), GITHUB_PAT (Issues r/w on the repo),
//      GITHUB_REPO (owner/name), FEEDBACK_ADMIN_EMAIL.

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
const MERGE_LABEL = 'claude-merge'

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

// Pull the PR number out of a stored github_pr_url (…/pull/123). Returns null if it doesn't
// look like a PR URL, so a malformed row can't send a merge at some arbitrary number.
function prNumberFromUrl(url: string | null): number | null {
  if (!url) return null
  const m = url.match(/\/pull\/(\d+)/)
  return m ? Number(m[1]) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Admin only.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    const adminEmail = (Deno.env.get('FEEDBACK_ADMIN_EMAIL') ?? 'itai.shubi@gmail.com').toLowerCase()
    if (!caller?.user || caller.user.email?.toLowerCase() !== adminEmail) {
      return json({ error: 'unauthorized' }, 401)
    }

    const { feedback_id } = await req.json().catch(() => ({}))
    if (!feedback_id || typeof feedback_id !== 'string') return json({ error: 'feedback_id required' }, 400)

    const { data: item } = await supabase
      .from('feedback')
      .select('id, status, archived_at, github_pr_url')
      .eq('id', feedback_id)
      .single()
    if (!item) return json({ error: 'feedback not found' }, 404)
    if (item.archived_at) return json({ error: 'הפריט כבר בארכיון.' }, 409)

    const pr = prNumberFromUrl(item.github_pr_url as string | null)
    if (!pr) return json({ error: 'אין עדיין בקשת-מיזוג לפריט הזה.' }, 409)
    // Only merge a fix that's actually up for review — never re-merge a running/failed item.
    if (item.status !== 'awaiting_review') {
      return json({ error: `אי אפשר למזג פריט בסטטוס "${item.status}".` }, 409)
    }

    const pat = Deno.env.get('GITHUB_PAT')
    if (!pat) return json({ error: 'GITHUB_PAT not configured' }, 500)

    // Ensure the label exists (idempotent — 422 = already there). Without this, the first
    // ever merge on a repo that has never seen the label would 404 on the apply below.
    await gh('/labels', 'POST', pat, { name: MERGE_LABEL, color: '1fa871', description: 'Merge this fix PR (owner-approved)' })
      .catch(() => {})

    // Label the PR (PRs share the issue-number space, so the issues-labels endpoint works
    // with only Issues:write). This fires claude-merge.yml → gh pr merge with GITHUB_TOKEN.
    const lRes = await gh(`/issues/${pr}/labels`, 'POST', pat, { labels: [MERGE_LABEL] })
    if (!lRes.ok) {
      const detail = await lRes.text()
      console.error('merge-feedback-pr label failed:', lRes.status, detail)
      return json({ error: `בקשת המיזוג נכשלה (${lRes.status}). אפשר למזג ידנית בגיטהאב.` }, 502)
    }

    // Surface it in the bot thread so the owner sees the merge is in motion (the 'fixed'
    // status + its own message arrive when the merge completes, via claude-fix-merged.yml).
    try {
      await supabase.from('feedback_messages').insert({
        feedback_id, author: 'bot', channel: 'bot',
        body: '🔀 שלחתי את התיקון למיזוג ופרסום — האתר יתעדכן בעוד רגע.',
      })
    } catch (e) {
      console.error('merge message insert (non-fatal):', e)
    }

    return json({ ok: true, pr })
  } catch (e) {
    console.error('merge-feedback-pr error:', e)
    return json({ error: String(e) }, 500)
  }
})
