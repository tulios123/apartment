import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pushToOwner, resolveAdminId } from '../_shared/push.ts'

// Section D — a DELIBERATELY NARROW endpoint the GitHub workflow calls back to move a
// feedback item's status (and record its PR URL). It exists so the workflow never holds
// a Supabase service-role key: it holds only the shared PIPELINE_SECRET, and this
// endpoint can update NOTHING except status / github_pr_url on a row it finds by issue
// number. Any other input → 400. Wrong/missing secret → 401.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), PIPELINE_SECRET.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pipeline-secret',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Only the pipeline-driven transitions — never 'new'/'sent' (those are set client-side
// / by the send function). This is the whole allow-list of what the workflow may write.
const ALLOWED_STATUS = new Set(['in_progress', 'awaiting_review', 'fixed', 'failed'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const secret = Deno.env.get('PIPELINE_SECRET')
    if (!secret || req.headers.get('x-pipeline-secret') !== secret) {
      return json({ error: 'unauthorized' }, 401)
    }

    const { github_issue_number, status, pr_url, bot_message } = await req.json().catch(() => ({}))

    if (typeof github_issue_number !== 'number' || !Number.isInteger(github_issue_number)) {
      return json({ error: 'github_issue_number (int) required' }, 400)
    }
    if (typeof status !== 'string' || !ALLOWED_STATUS.has(status)) {
      return json({ error: 'invalid status' }, 400)
    }
    if (pr_url !== undefined && typeof pr_url !== 'string') {
      return json({ error: 'pr_url must be a string' }, 400)
    }
    if (bot_message !== undefined && typeof bot_message !== 'string') {
      return json({ error: 'bot_message must be a string' }, 400)
    }
    // What the bot actually said (a clarifying question, a failure reason, a fix summary) —
    // shown verbatim in the admin console's "מול הבוט" thread, not just the generic status
    // pill. Capped so a runaway comment can't blow up the chat bubble.
    const botMessage = typeof bot_message === 'string' ? bot_message.trim().slice(0, 4000) : ''

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Only these two columns can ever be written here — nothing else is reachable.
    const patch: { status: string; status_updated_at: string; github_pr_url?: string } = {
      status,
      status_updated_at: new Date().toISOString(),
    }
    if (pr_url) patch.github_pr_url = pr_url

    const { data, error } = await supabase
      .from('feedback')
      .update(patch)
      .eq('github_issue_number', github_issue_number)
      .select('id')
    if (error) {
      console.error('update-feedback-status error:', error)
      return json({ error: 'update failed' }, 500)
    }
    if (!data || data.length === 0) {
      return json({ error: 'no feedback row for that issue number' }, 404)
    }
    const feedbackId = data[0].id as string

    // Drop what the bot actually said into the thread as a 'bot' message — service-role
    // only (see 039), so this is the ONE place that content ever reaches the admin console.
    // Best-effort: a message-insert failure must never fail the status callback (see the
    // push comment below — a non-200 here would wedge the one-run-at-a-time lock).
    if (botMessage) {
      try {
        await supabase.from('feedback_messages').insert({ feedback_id: feedbackId, author: 'bot', body: botMessage })
      } catch (e) {
        console.error('bot message insert (non-fatal):', e)
      }
    }

    // Autonomy: push the ADMIN on each pipeline transition so they manage the fix by
    // notification instead of polling the console. Best-effort in a try/catch — a push
    // failure must NEVER fail this callback (the one-run-at-a-time lock depends on a 200
    // here to release the item; a 500 would wedge the pipeline).
    try {
      const STATUS_PUSH: Record<string, [string, string]> = {
        in_progress: ['הבוט התחיל לעבוד על התיקון', ''],
        awaiting_review: ['התיקון מוכן לבדיקה', 'בדקו באפליקציה ואשרו את בקשת-המיזוג'],
        fixed: ['תוקן ומוזג ✓', ''],
        failed: ['הבוט לא הצליח', 'אפשר לחדד את ההערות ולשלוח שוב'],
      }
      const spec = STATUS_PUSH[status]
      const adminId = spec ? await resolveAdminId(supabase) : null
      if (spec && adminId) {
        const { data: item } = await supabase.from('feedback').select('note').eq('id', feedbackId).single()
        const firstLine = String(item?.note ?? '').split('\n')[0].slice(0, 90)
        const [title, extra] = spec
        // Prefer the bot's own words over the generic blurb — it's the actual answer/
        // question, which is the whole point of surfacing this push.
        const detail = botMessage ? botMessage.slice(0, 120) : extra
        await pushToOwner(supabase, adminId, {
          title,
          body: [detail, firstLine].filter(Boolean).join('\n') || firstLine || 'עודכן סטטוס',
          url: `/admin/feedback?item=${feedbackId}`,
          tag: `apt-feedback-${feedbackId}`,
        })
      }
    } catch (e) {
      console.error('status push (non-fatal):', e)
    }

    return json({ ok: true, updated: data.length })
  } catch (e) {
    console.error('update-feedback-status error:', e)
    return json({ error: String(e) }, 500)
  }
})
