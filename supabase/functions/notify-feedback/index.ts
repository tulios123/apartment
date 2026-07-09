import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

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

const CATEGORY_LABEL: Record<string, string> = {
  bug: 'תקלה',
  feature: 'רעיון',
  question: 'שאלה',
  other: 'משוב',
}

// Fired by the client right after a family member saves a feedback note. Sends a web
// push to the owner's devices so they hear about it immediately. The push goes to the
// admin account that reviews feedback (FEEDBACK_ADMIN_EMAIL, default the owner's
// personal Google account) — resolved to its owner_id, whose push_subscriptions we send.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Only a signed-in user (the reporting family member) may trigger a notification.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await supabase.auth.getUser(token)
    if (!caller?.user) return json({ error: 'unauthorized' }, 401)

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:itai.shubi@gmail.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const { category, screen, editContext, note, feedback_id } = await req.json().catch(() => ({}))

    // Resolve the admin (feedback reviewer) → their devices get the push.
    const adminEmail = (Deno.env.get('FEEDBACK_ADMIN_EMAIL') ?? 'itai.shubi@gmail.com').toLowerCase()
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    const admin = list?.users.find((u) => u.email?.toLowerCase() === adminEmail)
    if (!admin) return json({ ok: true, delivered: 0, note: 'admin not found' })

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('owner_id', admin.id)
    if (!subs || subs.length === 0) return json({ ok: true, delivered: 0 })

    const kind = CATEGORY_LABEL[category as string] ?? 'משוב'
    const where = [screen, editContext].filter(Boolean).map(String).join(' · ')
    const snippet = String(note ?? '').slice(0, 90)
    // Deep-link the admin straight to this item when we have its id (per-item tag so a
    // burst of reports doesn't coalesce into one notification).
    const url = feedback_id ? `/admin/feedback?item=${feedback_id}` : '/admin/feedback'
    const payload = JSON.stringify({
      title: `משוב חדש · ${kind}`,
      body: [where, snippet].filter(Boolean).join('\n') || 'התקבל משוב חדש',
      url,
      tag: feedback_id ? `apt-feedback-${feedback_id}` : 'apt-feedback',
    })

    let delivered = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        delivered++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }

    return json({ ok: true, delivered })
  } catch (e) {
    console.error('notify-feedback error:', e)
    return json({ error: String(e) }, 500)
  }
})
