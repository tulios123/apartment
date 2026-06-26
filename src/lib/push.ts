import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** The client has a VAPID public key — without it, subscribing is impossible. */
export function pushConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY
}

/** Browser supports the full web-push stack (SW + PushManager + Notification). */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** iOS only delivers web push to an installed (home-screen) PWA. */
export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  const displayStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  return iosStandalone || displayStandalone
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS 13+ reports as "MacIntel" — disambiguate by touch points.
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js')
}

/** True if this device already holds an active push subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

/**
 * Request permission, subscribe via PushManager, and persist the subscription
 * (upsert on endpoint). Throws 'denied' if the user declines.
 */
export async function enablePush(ownerId: string): Promise<void> {
  if (!pushSupported()) throw new Error('unsupported')
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY missing')

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerSW())
  if (!reg) throw new Error('no-sw')
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      owner_id: ownerId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/**
 * EDGE-11: opportunistic re-subscribe. The browser can rotate or expire a push
 * endpoint at any time; the stored subscription then goes dead and the daily
 * function prunes it on a 404/410 — silently ending pushes until the user toggles
 * them off/on. Called on app open: if permission is still granted but there's no
 * live subscription, re-subscribe + re-upsert (no permission prompt, since granted).
 */
export async function ensurePushFresh(ownerId: string): Promise<void> {
  if (!pushSupported() || !pushConfigured()) return
  if (Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (sub) return // still alive — nothing to do
    await enablePush(ownerId)
  } catch {
    // Best-effort recovery — never block app start on it.
  }
}

/** Remove this device's subscription from the server and unsubscribe locally. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

/** Local notification — verifies SW + permission without the server round-trip. */
export async function sendTestNotification(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('no-sw')
  await reg.showNotification('ניהול דירה', {
    body: 'התראת בדיקה — הכול עובד ✅',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'he',
    tag: 'apt-test',
    data: { url: '/' },
  } as NotificationOptions)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
