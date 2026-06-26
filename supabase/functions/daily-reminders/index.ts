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

// Lease-lifecycle reminder cadence (mirrors src/lib/constants.ts). The cron runs
// daily, but these reminders are throttled via the reminder_log table.
const RENEWAL_WINDOW_DAYS = 60   // renewal reminder starts ~2 months before the end
const RENEWAL_REPEAT_DAYS = 28   // then repeats ~monthly while still in the window
const NO_LEASE_REPEAT_DAYS = 14  // "no active lease" reminder repeats fortnightly

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
      // Recurring items that produced an approval line here, so section 3 can skip
      // their generated task and not list the same thing twice (audit C6).
      const section1ItemIds = new Set<string>()

      // 1) Approval items whose due day has passed and aren't recorded this month.
      const { data: items } = await supabase
        .from('recurring_items')
        .select('id, direction, category, payee, payment_method, day_of_month, start_date, end_date')
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
          section1ItemIds.add(it.id)
          // Post-dated-check rent → remind to DEPOSIT the check, not "collect rent".
          if (it.direction === 'income' && it.payment_method === 'check') {
            lines.push(`הפקדת צ׳ק שכר דירה${it.payee ? ` – ${it.payee}` : ''}`)
          } else {
            const label = it.direction === 'income' ? 'גביית' : 'תשלום'
            lines.push(`${label} ${it.category}${it.payee ? ` – ${it.payee}` : ''}`)
          }
        }
      }

      // 2) Lease lifecycle — throttled via reminder_log, NOT sent daily.
      const { data: rlog } = await supabase
        .from('reminder_log').select('kind, last_sent').eq('owner_id', ownerId)
      const lastSent = new Map((rlog ?? []).map((r) => [r.kind as string, r.last_sent as string]))
      const cadenceDue = (kind: string, days: number) => {
        const ls = lastSent.get(kind)
        return !ls || daysBetween(ls, today) >= days
      }
      let logRenewal = false
      let logNoLease = false

      // Contracts still active or upcoming (ending today or later).
      const { data: liveContracts } = await supabase
        .from('contracts')
        .select('company_name, start_date, end_date')
        .eq('owner_id', ownerId)
        .gte('end_date', today)

      // 2a) Renewal: an already-started contract ending within ~2 months → remind
      // ~monthly until it ends.
      const renewing = (liveContracts ?? [])
        .filter((c) => c.start_date <= today && daysBetween(today, c.end_date) <= RENEWAL_WINDOW_DAYS)
        .sort((a, b) => a.end_date.localeCompare(b.end_date))
      if (renewing.length > 0 && cadenceDue('renewal', RENEWAL_REPEAT_DAYS)) {
        const c = renewing[0]
        lines.push(`חידוש חוזה עם ${c.company_name} – נותרו ${daysBetween(today, c.end_date)} ימים`)
        logRenewal = true
      }

      // 2b) No active/upcoming lease at all → fortnightly nudge (only when the owner
      // actually has a property, so a brand-new user isn't nagged).
      if ((liveContracts ?? []).length === 0) {
        const { count } = await supabase
          .from('properties').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId)
        if ((count ?? 0) > 0 && cadenceDue('no-lease', NO_LEASE_REPEAT_DAYS)) {
          lines.push('אין חוזה שכירות פעיל — מומלץ להוסיף שוכר חדש')
          logNoLease = true
        }
      }

      // 3) Open tasks due today or overdue.
      const { data: tasks } = await supabase
        .from('tasks')
        .select('title, due_date, due_time, source, recurring_item_id')
        .eq('owner_id', ownerId)
        .eq('status', 'open')
        .not('due_date', 'is', null)
        .lte('due_date', today)
      for (const t of tasks ?? []) {
        // C6: skip tasks already covered above — renewal tasks (handled by 2a with a
        // live day count, so the frozen task title doesn't double it) and approval
        // tasks whose recurring item already produced a section-1 line.
        if (t.source === 'renewal') continue
        if (t.recurring_item_id && section1ItemIds.has(t.recurring_item_id)) continue
        lines.push(t.due_time ? `${t.title} – ${String(t.due_time).slice(0, 5)}` : t.title)
      }

      // C6 belt-and-suspenders: collapse any remaining identical lines before composing.
      const finalLines = [...new Set(lines)]

      if (finalLines.length === 0) {
        // Nothing pending — release the day-claim so a later run today can still notify.
        await supabase.from('push_log').delete().eq('owner_id', ownerId).eq('sent_on', today)
        continue
      }

      const body =
        finalLines.length === 1
          ? finalLines[0]
          : `${finalLines.length} דברים דורשים טיפול\n• ${finalLines.slice(0, 3).join('\n• ')}`
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

      if (delivered > 0) {
        sentOwners++
        // Record cadence only after the push actually went out (else it retries
        // tomorrow). upsert so the next eligible day is RENEWAL/NO_LEASE_REPEAT_DAYS off.
        if (logRenewal) await supabase.from('reminder_log').upsert({ owner_id: ownerId, kind: 'renewal', last_sent: today }, { onConflict: 'owner_id,kind' })
        if (logNoLease) await supabase.from('reminder_log').upsert({ owner_id: ownerId, kind: 'no-lease', last_sent: today }, { onConflict: 'owner_id,kind' })
      } else {
        await supabase.from('push_log').delete().eq('owner_id', ownerId).eq('sent_on', today)
      }
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
