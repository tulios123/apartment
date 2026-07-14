// Shared web-push helper for the feedback functions. Centralises VAPID setup, the
// feedback-admin account lookup, and the "send to an owner's devices + prune dead subs"
// loop, so each function isn't a copy of the same 20 lines. Mirrors the loop that has
// lived inline in notify-feedback since Stage B.

import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

let vapidReady = false
function setupVapid() {
  if (vapidReady) return
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:itai.shubi@gmail.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )
  vapidReady = true
}

export type PushPayload = { title: string; body: string; url: string; tag: string }

// Resolve the feedback-admin account (itai's real login) to its owner_id, or null if not
// found. Used to route "new item" / "bot status" / "client replied" pushes to the owner.
export async function resolveAdminId(supabase: SupabaseClient): Promise<string | null> {
  // Feedback pushes go to the MANAGEMENT account (FEEDBACK_NOTIFY_EMAIL = tuliosking) so they
  // land on the staging/management app, NOT the owner's personal account. Falls back to
  // FEEDBACK_ADMIN_EMAIL (itai) if the notify address isn't configured.
  const notifyEmail = (
    Deno.env.get('FEEDBACK_NOTIFY_EMAIL') ?? Deno.env.get('FEEDBACK_ADMIN_EMAIL') ?? 'itai.shubi@gmail.com'
  ).toLowerCase()
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  return list?.users.find((u) => u.email?.toLowerCase() === notifyEmail)?.id ?? null
}

// Push a payload to every device an owner has registered. Dead endpoints (404/410) are
// pruned. Returns how many were delivered. NEVER throws — callers treat push as
// best-effort and must not fail their main flow on a push error.
export async function pushToOwner(
  supabase: SupabaseClient,
  ownerId: string,
  payload: PushPayload,
): Promise<number> {
  try {
    setupVapid()
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('owner_id', ownerId)
    if (!subs || subs.length === 0) return 0

    const body = JSON.stringify(payload)
    let delivered = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          // High urgency asks the push service (APNs/FCM) to deliver promptly rather than
          // batching — these are time-sensitive ("bot started", "fix ready", "client replied").
          { urgency: 'high', TTL: 3600 },
        )
        delivered++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }
    return delivered
  } catch (e) {
    console.error('pushToOwner error (non-fatal):', e)
    return 0
  }
}
