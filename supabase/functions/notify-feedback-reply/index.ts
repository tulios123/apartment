import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pushToOwner, resolveAdminId } from '../_shared/push.ts'

// Pushes the COUNTERPARTY after a chat message is inserted (via RLS) on a feedback item:
//   • admin replied  → push the reporting client ("עדכון על המשוב שלך").
//   • client replied → push the admin ("תגובה חדשה מלקוח").
// The message body is written client-side via RLS; this fn ONLY sends the notification and
// re-derives the recipient server-side from the row — it never trusts the caller for who to
// notify, and it authorises the caller against the message's author so no one can push as
// the other side. Bot/system messages don't notify (they're already surfaced in the UI).
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

    // Caller must be signed in (either the admin or the reporting family member).
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    if (!caller?.user) return json({ error: 'unauthorized' }, 401)

    const { message_id } = await req.json().catch(() => ({}))
    if (!message_id || typeof message_id !== 'string') {
      return json({ error: 'message_id required' }, 400)
    }

    // Load the message, then the feedback row it belongs to (service role — bypasses RLS).
    const { data: msg } = await supabase
      .from('feedback_messages')
      .select('id, feedback_id, author, body')
      .eq('id', message_id)
      .single()
    if (!msg) return json({ error: 'message not found' }, 404)
    if (msg.author === 'bot' || msg.author === 'system') {
      return json({ ok: true, delivered: 0, note: 'non-human author' })
    }

    const { data: fb } = await supabase
      .from('feedback')
      .select('owner_id, email')
      .eq('id', msg.feedback_id)
      .single()
    if (!fb) return json({ error: 'feedback not found' }, 404)

    const adminEmail = (Deno.env.get('FEEDBACK_ADMIN_EMAIL') ?? 'itai.shubi@gmail.com').toLowerCase()
    const callerEmail = caller.user.email?.toLowerCase()
    const feedbackId = msg.feedback_id as string
    const snippet = String(msg.body ?? '').slice(0, 90)
    const tag = `apt-feedback-${feedbackId}`

    if (msg.author === 'admin') {
      // Only the actual admin may have posted an 'admin' message — push the client.
      if (callerEmail !== adminEmail) return json({ error: 'forbidden' }, 403)
      const tmpl = Deno.env.get('CLIENT_THREAD_URL_TEMPLATE') ?? '/?fb={id}'
      const delivered = await pushToOwner(supabase, fb.owner_id, {
        title: 'עדכון על המשוב שלך',
        body: snippet || 'קיבלת תגובה חדשה',
        url: tmpl.replace('{id}', feedbackId),
        tag,
      })
      return json({ ok: true, delivered })
    }

    // author === 'client' — only the row owner may have posted it → push the admin.
    if (caller.user.id !== fb.owner_id) return json({ error: 'forbidden' }, 403)
    const adminId = await resolveAdminId(supabase)
    if (!adminId) return json({ ok: true, delivered: 0, note: 'admin not found' })
    const delivered = await pushToOwner(supabase, adminId, {
      title: 'תגובה חדשה מלקוח',
      body: [fb.email, snippet].filter(Boolean).join('\n') || 'התקבלה תגובה חדשה',
      url: `/admin/feedback?item=${feedbackId}`,
      tag,
    })
    return json({ ok: true, delivered })
  } catch (e) {
    console.error('notify-feedback-reply error:', e)
    return json({ error: String(e) }, 500)
  }
})
