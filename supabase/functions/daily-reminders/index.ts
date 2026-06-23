import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// Israel-local YYYY-MM-DD. The date columns (contracts.end_date, recurring_items.
// end_date, tasks.due_date) are date-only — comparing against a UTC new Date()
// would slip a day around midnight, so we anchor "today" to Asia/Jerusalem.
function israelToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

// Whole-day diff between two date-only strings (both anchored at UTC midnight → no
// hour drift). Mirrors the ceil-based daysLeft in useMonthlyGeneration.
function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number)
  const [ty, tm, td] = toISO.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}

function json(obj: unknown) {
  return new Response(JSON.stringify(obj), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:itai.shubi@gmail.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const today = israelToday()
    const [yy, mm, dd] = today.split('-')
    const monthStart = `${yy}-${mm}-01`
    const todayDay = Number(dd)

    // Owners with at least one push subscription.
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('owner_id, endpoint, p256dh, auth')
    if (!subs || subs.length === 0) return json({ ok: true, owners: 0 })

    const byOwner = new Map<string, typeof subs>()
    for (const s of subs) {
      const arr = byOwner.get(s.owner_id) ?? []
      arr.push(s)
      byOwner.set(s.owner_id, arr)
    }

    let sentOwners = 0

    for (const [ownerId, ownerSubs] of byOwner) {
      // Once/day guard: claim the slot first so a concurrent/retried run can't
      // double-send. If the row already exists (or errors), skip this owner.
      const { error: logErr } = await supabase
        .from('push_log')
        .insert({ owner_id: ownerId, sent_on: today })
      if (logErr) continue

      const lines: string[] = []

      // 1) Approval items whose due day has passed and aren't recorded this month.
      const { data: items } = await supabase
        .from('recurring_items')
        .select('id, direction, category, payee, day_of_month, start_date, end_date')
        .eq('owner_id', ownerId)
        .eq('execution_type', 'requires_approval')
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${monthStart}`)

      const dueItems = (items ?? []).filter((it) => it.day_of_month <= todayDay)
      if (dueItems.length > 0) {
        const { data: txThisMonth } = await supabase
          .from('transactions')
          .select('recurring_item_id')
          .eq('owner_id', ownerId)
          .gte('date', monthStart)
          .lte('date', today)
          .not('recurring_item_id', 'is', null)
        const recorded = new Set((txThisMonth ?? []).map((t) => t.recurring_item_id))
        for (const it of dueItems) {
          if (recorded.has(it.id)) continue
          const label = it.direction === 'income' ? 'גביית' : 'תשלום'
          lines.push(`${label} ${it.category}${it.payee ? ` – ${it.payee}` : ''}`)
        }
      }

      // 2) Contract renewals within the alert window.
      const { data: contracts } = await supabase
        .from('contracts')
        .select('company_name, end_date, renewal_alert_days')
        .eq('owner_id', ownerId)
        .gte('end_date', today)
      for (const c of contracts ?? []) {
        const alertDays: number[] = c.renewal_alert_days ?? [90, 30]
        const left = daysBetween(today, c.end_date)
        if (left <= Math.max(...alertDays)) {
          lines.push(`חידוש חוזה עם ${c.company_name} – נותרו ${left} ימים`)
        }
      }

      // 3) Open tasks due today or overdue.
      const { data: tasks } = await supabase
        .from('tasks')
        .select('title, due_date')
        .eq('owner_id', ownerId)
        .eq('status', 'open')
        .not('due_date', 'is', null)
        .lte('due_date', today)
      for (const t of tasks ?? []) lines.push(t.title)

      if (lines.length === 0) {
        // Nothing pending — release the day-claim so a later run today can still notify.
        await supabase.from('push_log').delete().eq('owner_id', ownerId).eq('sent_on', today)
        continue
      }

      const body =
        lines.length === 1
          ? lines[0]
          : `${lines.length} דברים דורשים טיפול\n• ${lines.slice(0, 3).join('\n• ')}`
      const payload = JSON.stringify({ title: 'ניהול דירה', body, url: '/', tag: 'apt-daily' })

      let delivered = 0
      for (const sub of ownerSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          delivered++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            // Subscription is dead — prune it.
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        }
      }

      if (delivered > 0) sentOwners++
      else await supabase.from('push_log').delete().eq('owner_id', ownerId).eq('sent_on', today)
    }

    return json({ ok: true, owners: byOwner.size, sentOwners })
  } catch (e) {
    console.error('daily-reminders error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
