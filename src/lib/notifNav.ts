// Bridges a service-worker "navigate" message (notification tap) to react-router.
// The message can arrive when no Router is mounted yet — on Login/Onboarding or
// during cold paint (audit EDGE-08), where the old Layout-only listener dropped it.
// So we buffer the last target and replay it once a consumer inside the Router
// subscribes, guaranteeing the tap lands on the right screen.

let pending: string | null = null
const listeners = new Set<(url: string) => void>()

export function pushNotifTarget(url: string): void {
  if (listeners.size > 0) {
    listeners.forEach((l) => l(url))
  } else {
    // No Router-bound consumer yet — hold it until one subscribes.
    pending = url
  }
}

export function subscribeNotifTarget(fn: (url: string) => void): () => void {
  listeners.add(fn)
  if (pending) {
    const url = pending
    pending = null
    fn(url)
  }
  return () => { listeners.delete(fn) }
}
