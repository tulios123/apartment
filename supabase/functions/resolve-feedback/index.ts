import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pushToOwner } from '../_shared/push.ts'
import { isAdminEmail } from '../_shared/admin.ts'

// "סמן כטופל" / "החזר לפעיל" — ADMIN ONLY. Archives (or un-archives) a feedback item,
// writes a 'system' message into its thread, and pushes the reporting client. This is the
// SINGLE audited path that writes feedback.archived_at (the column is intentionally NOT in
// the authenticated grant, so no client/admin can archive over plain RLS — see 039).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), VAPID_*, FEEDBACK_ADMIN_EMAIL,
//      CLIENT_THREAD_URL_TEMPLATE (optional, default '/?fb={id}').

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

    // Admin only — verify the caller's token and email (mirrors send-feedback-to-claude).
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    if (!caller?.user || !isAdminEmail(caller.user.email)) {
      return json({ error: 'unauthorized' }, 401)
    }

    const { feedback_id, message, reopen } = await req.json().catch(() => ({}))
    if (!feedback_id || typeof feedback_id !== 'string') {
      return json({ error: 'feedback_id required' }, 400)
    }

    const { data: fb } = await supabase
      .from('feedback')
      .select('owner_id, email, status, archived_at')
      .eq('id', feedback_id)
      .single()
    if (!fb) return json({ error: 'feedback not found' }, 404)

    const now = new Date().toISOString()

    // ── Reopen: un-archive, drop a system line, no client push (internal action) ──────
    if (reopen === true) {
      const { error } = await supabase
        .from('feedback')
        .update({ archived_at: null, status_updated_at: now })
        .eq('id', feedback_id)
      if (error) { console.error('reopen failed:', error); return json({ error: 'update failed' }, 500) }
      await supabase.from('feedback_messages').insert({ feedback_id, author: 'system', body: 'הטיפול נפתח מחדש.' })
      return json({ ok: true, reopened: true })
    }

    // ── Resolve (archive): set archived_at, optionally close status, notify the client ──
    // Never yank a row the bot is actively fixing: only flip status→'fixed' when the item
    // isn't running (sent/in_progress) and isn't already fixed — so we never fabricate a
    // 'fixed' over a live run nor collide with the single-active index.
    const active = fb.status === 'sent' || fb.status === 'in_progress'
    const patch: Record<string, unknown> = { archived_at: now, status_updated_at: now }
    if (!active && fb.status !== 'fixed') patch.status = 'fixed'
    const { error } = await supabase.from('feedback').update(patch).eq('id', feedback_id)
    if (error) { console.error('resolve failed:', error); return json({ error: 'update failed' }, 500) }

    const closing = (typeof message === 'string' && message.trim()) ? message.trim() : 'הדיווח שלך טופל. תודה!'
    await supabase.from('feedback_messages').insert({ feedback_id, author: 'system', body: closing })

    const tmpl = Deno.env.get('CLIENT_THREAD_URL_TEMPLATE') ?? '/?fb={id}'
    const delivered = await pushToOwner(supabase, fb.owner_id, {
      title: 'הדיווח שלך טופל ✓',
      body: closing.slice(0, 120),
      url: tmpl.replace('{id}', feedback_id),
      tag: `apt-feedback-${feedback_id}`,
    })

    return json({
      ok: true,
      delivered,
      warning: active ? 'הפריט עדיין בתהליך תיקון אצל הבוט — הועבר לארכיון, אך הסטטוס נשמר.' : undefined,
    })
  } catch (e) {
    console.error('resolve-feedback error:', e)
    return json({ error: String(e) }, 500)
  }
})
