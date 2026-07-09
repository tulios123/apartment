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

    // Load the item — need its content to build the issue and its current status.
    const { data: item, error: itemErr } = await supabase
      .from('feedback')
      .select('id, note, path, admin_notes, category, context, screenshot_path, status')
      .eq('id', feedback_id)
      .single()
    if (itemErr || !item) return json({ error: 'feedback not found' }, 404)
    // 'awaiting_review' is resendable too: the owner reviewed an open PR, decided it
    // doesn't actually solve it, and wants another pass — mirrors RESENDABLE_STATUSES
    // in src/lib/feedbackStatus.ts (kept in sync manually; the two run in different
    // runtimes and can't share an import).
    if (!['new', 'failed', 'awaiting_review'].includes(item.status)) {
      return json({ error: `לא ניתן לשלוח פריט בסטטוס "${item.status}".` }, 409)
    }

    // Signed URL for the screenshot (7-day expiry), if one is attached.
    let shotUrl: string | null = null
    if (item.screenshot_path) {
      const { data: signed } = await supabase.storage
        .from('feedback')
        .createSignedUrl(item.screenshot_path, SEVEN_DAYS)
      shotUrl = signed?.signedUrl ?? null
    }

    // Issue body — carries everything the fixer needs + parseable markers
    // (Screenshot: <url>, feedback_id: <id>) the workflow reads back.
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

    // ATOMIC one-run-at-a-time claim: flip this row to 'sent' BEFORE opening the issue.
    // The partial unique index (migration 038) makes a second concurrent claim fail with
    // a unique violation, so two sends can never both open an issue. Only claims a row
    // still in new/failed (guards the race between the load above and here).
    const now = new Date().toISOString()
    const claim = await supabase
      .from('feedback')
      .update({ status: 'sent', sent_at: now, status_updated_at: now })
      .eq('id', feedback_id)
      .in('status', ['new', 'failed', 'awaiting_review'])
      .select('id')
    if (claim.error) {
      if ((claim.error as { code?: string }).code === '23505') {
        // Unique violation on feedback_single_active_idx → another item is already active.
        return json({ error: 'כבר יש פריט פעיל בתהליך — יש להמתין לסיומו לפני שליחת פריט נוסף.' }, 409)
      }
      console.error('claim failed:', claim.error)
      return json({ error: 'שגיאה בשליחה — נסו שוב.' }, 500)
    }
    if (!claim.data || claim.data.length === 0) {
      return json({ error: 'הפריט כבר אינו זמין לשליחה — רעננו את הרשימה.' }, 409)
    }

    // Open the GitHub issue. If it fails, RELEASE the claim so the item isn't wedged.
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
      await supabase.from('feedback')
        .update({ status: item.status, sent_at: null, status_updated_at: new Date().toISOString() })
        .eq('id', feedback_id)
      return json({ error: `פתיחת התקלה בגיטהאב נכשלה (${ghRes.status}).` }, 502)
    }
    const issue = await ghRes.json()

    // Link the issue number so the status callbacks can find this row. If this fails the
    // item is 'sent' but unlinked — surface it (non-200), not a false success.
    const { error: linkErr } = await supabase
      .from('feedback')
      .update({ github_issue_number: issue.number, status_updated_at: new Date().toISOString() })
      .eq('id', feedback_id)
    if (linkErr) {
      console.error('feedback link update failed after issue open:', linkErr)
      return json({ error: `התקלה נפתחה בגיטהאב (#${issue.number}) אך לא נקשרה לפריט — בדקו ידנית.` }, 500)
    }

    return json({ ok: true, issue_number: issue.number, issue_url: issue.html_url })
  } catch (e) {
    console.error('send-feedback-to-claude error:', e)
    return json({ error: String(e) }, 500)
  }
})
