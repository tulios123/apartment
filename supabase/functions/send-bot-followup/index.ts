import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isAdminEmail } from '../_shared/admin.ts'

// Live bot chat — the owner types guidance/answers to the auto-fix bot from the "מול הבוט"
// channel, and this fn (a) records it as a bot-channel message, (b) posts it as a comment on
// the GitHub issue so the next run sees it, and (c) re-triggers the claude-fix workflow by
// re-applying the label. Admin-only. The bot's reply comes back through the workflow's
// update-feedback-status callback (bot_message) as a 'bot' message in the same channel.
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
const FIX_LABEL = 'claude-fix'

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

    // Admin only.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    if (!caller?.user || !isAdminEmail(caller.user.email)) {
      return json({ error: 'unauthorized' }, 401)
    }

    const { feedback_id, message, screenshot_paths } = await req.json().catch(() => ({}))
    if (!feedback_id || typeof feedback_id !== 'string') return json({ error: 'feedback_id required' }, 400)
    const body = typeof message === 'string' ? message.trim() : ''
    // Storage paths of screenshots the owner already uploaded from the console — attach them
    // to this guidance so the bot sees them mid-conversation, not only on the first report.
    const shotPaths: string[] = Array.isArray(screenshot_paths)
      ? (screenshot_paths as unknown[]).filter((p): p is string => typeof p === 'string' && p.length > 0).slice(0, 6)
      : []
    if (!body && shotPaths.length === 0) return json({ error: 'message or screenshots required' }, 400)

    const { data: item } = await supabase
      .from('feedback')
      .select('github_issue_number')
      .eq('id', feedback_id)
      .single()
    if (!item) return json({ error: 'feedback not found' }, 404)
    if (item.github_issue_number == null) {
      return json({ error: 'צריך קודם לשלוח את התקלה לבוט לפני שאפשר לכתוב לו.' }, 409)
    }
    const issue = item.github_issue_number as number

    const pat = Deno.env.get('GITHUB_PAT')
    if (!pat) return json({ error: 'GITHUB_PAT not configured' }, 500)

    // Sign the attached screenshots (7-day) so the workflow can download them into the bot's
    // task, exactly like the initial report's images.
    const signedShots: string[] = []
    for (const p of shotPaths) {
      const { data: signed } = await supabase.storage.from('feedback').createSignedUrl(p, 60 * 60 * 24 * 7)
      if (signed?.signedUrl) signedShots.push(signed.signedUrl)
    }
    const shownBody = body || '📎 צירפתי צילומים'

    // 1) Record the owner's guidance in the bot channel (service role → channel='bot'), with
    //    the attached screenshots so the console renders them in the chat bubble.
    const { data: inserted } = await supabase
      .from('feedback_messages')
      .insert({
        feedback_id,
        author: 'admin',
        author_id: caller.user.id,
        author_email: caller.user.email ?? null,
        body: shownBody,
        channel: 'bot',
        screenshot_paths: shotPaths,
      })
      .select('id')
      .single()

    // 2) Post it as an issue comment so the next run reads it as owner guidance. The
    //    `Screenshot: <url>` lines are exactly what claude-fix's download step scans for.
    const shotLines = signedShots.map(u => `Screenshot: ${u}`).join('\n')
    const comment = [`🧑‍💻 **הנחיה מהבעלים:**`, '', shownBody, ...(shotLines ? ['', shotLines] : [])].join('\n')
    const cRes = await gh(`/issues/${issue}/comments`, 'POST', pat, { body: comment })
    if (!cRes.ok) {
      const detail = await cRes.text()
      console.error('github comment failed:', cRes.status, detail)
      return json({ error: `כתיבת ההערה בגיטהאב נכשלה (${cRes.status}).` }, 502)
    }

    // 3) Re-trigger the auto-fix run by re-applying the label (labeled fires the workflow).
    //    Remove first — adding an already-present label doesn't re-fire. A missing label on
    //    remove is fine (404 ignored).
    await gh(`/issues/${issue}/labels/${FIX_LABEL}`, 'DELETE', pat).catch(() => {})
    const lRes = await gh(`/issues/${issue}/labels`, 'POST', pat, { labels: [FIX_LABEL] })
    if (!lRes.ok) {
      const detail = await lRes.text()
      console.error('github re-label failed:', lRes.status, detail)
      return json({ error: `הפעלת הבוט מחדש נכשלה (${lRes.status}). ההערה נשמרה.` }, 502)
    }

    return json({ ok: true, message_id: inserted?.id ?? null })
  } catch (e) {
    console.error('send-bot-followup error:', e)
    return json({ error: String(e) }, 500)
  }
})
