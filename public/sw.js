// Service worker for web-push reminders (Stage B).
// Push + notification-click only — there is intentionally NO fetch handler, so it
// never interferes with the app's network/HMR and caches nothing.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (_e) { data = {} }

  const title = data.title || 'ניהול דירה'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'he',
    tag: data.tag || 'apt-daily',
    renotify: true,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      // Reuse an already-open app window: focus it and let the SPA route in-app
      // (the app listens for this message in Layout and calls react-router navigate).
      if ('focus' in client) {
        await client.focus()
        client.postMessage({ type: 'navigate', url })
        return
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
