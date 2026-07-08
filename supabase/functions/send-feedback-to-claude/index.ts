import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Section C — open a GitHub issue for a feedback item so the claude-fix workflow can
// pick it up. Admin-only, one-run-at-a-time. Called from the feedback admin screen.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), GITHUB_PAT (fine-grained, Issues
// r/w on this repo only), GITHUB_REPO (owner/name, default below), FEEDBACK_ADMIN_EMAIL.

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
const SEVEN_DAYS = 60 * 60 * 24 * 7

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Admin only — verify the caller's token and email.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    const adminEmail = (Deno.env.get('FEEDBACK_ADMIN_EMAIL') ?? 'itai.shubi@gmail.com').toLowerCase()
    if (!caller?.user || caller.user.email?.toLowerCase() !== adminEmail) {
      return json({ error: 'unauthorized' }, 401)
    }

    const { feedback_id } = await req.json().catch(() => ({}))
    if (!feedback_id || typeof feedback_id !== 'string') {
      return json({ error: 'feedback_id required' }, 400)
    }

    // 2. One run at a time — block if any OTHER item is already active.
    const { data: active } = await supabase
      .from('feedback')
      .select('id')
      .in('status', ['sent', 'in_progress'])
      .neq('id', feedback_id)
      .limit(1)
    if (active && active.length > 0) {
      return json({ error: 'כבר יש פריט פעיל בתהליך — יש להמתין לסיומו לפני שליחת פריט נוסף.' }, 409)
    }

    // Load the item.
    const { data: item, error: itemErr } = await supabase
      .from('feedback')
      .select('id, note, path, admin_notes, category, context, screenshot_path, status')
      .eq('id', feedback_id)
      .single()
    if (itemErr || !item) return json({ error: 'feedback not found' }, 404)
    if (!['new', 'failed'].includes(item.status)) {
      return json({ error: `לא ניתן לשלוח פריט בסטטוס "${item.status}".` }, 409)
    }

    // 3. Signed URL for the screenshot (7-day expiry), if one is attached.
    let shotUrl: string | null = null
    if (item.screenshot_path) {
      const { data: signed } = await supabase.storage
        .from('feedback')
        .createSignedUrl(item.screenshot_path, SEVEN_DAYS)
      shotUrl = signed?.signedUrl ?? null
    }

    // 4. Open the GitHub issue. Body carries everything the fixer needs + parseable
    //    markers (Screenshot: <url>, feedback_id: <id>) the workflow reads back.
    const note = String(item.note ?? '').trim()
    const title = (note.split('\n')[0] || 'Feedback').slice(0, 200)
    const body = [
      note,
      '',
      '---',
      `Admin notes: ${item.admin_notes?.trim() || '—'}`,
      `Reported path: ${item.path || '—'}`,
      `Category: ${item.category || '—'}`,
      `Context: ${item.context || '—'}`,
      `Screenshot: ${shotUrl || 'none'}`,
      '',
      `feedback_id: ${item.id}`,
    ].join('\n')

    const githubPat = Deno.env.get('GITHUB_PAT')
    if (!githubPat) return json({ error: 'GITHUB_PAT not configured' }, 500)

    const ghRes = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubPat}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'apartment-feedback-pipeline',
      },
      body: JSON.stringify({ title, body, labels: [FIX_LABEL] }),
    })
    if (!ghRes.ok) {
      const detail = await ghRes.text()
      console.error('github issue create failed:', ghRes.status, detail)
      return json({ error: `פתיחת התקלה בגיטהאב נכשלה (${ghRes.status}).` }, 502)
    }
    const issue = await ghRes.json()

    // 5. Mark the row sent.
    const now = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('feedback')
      .update({
        status: 'sent',
        github_issue_number: issue.number,
        sent_at: now,
        status_updated_at: now,
      })
      .eq('id', feedback_id)
    if (updErr) {
      console.error('feedback update failed after issue open:', updErr)
      // The issue is already open — report the number so the admin isn't left blind.
      return json({ ok: true, warning: 'issue opened but row update failed', issue_number: issue.number }, 200)
    }

    return json({ ok: true, issue_number: issue.number, issue_url: issue.html_url })
  } catch (e) {
    console.error('send-feedback-to-claude error:', e)
    return json({ error: String(e) }, 500)
  }
})
