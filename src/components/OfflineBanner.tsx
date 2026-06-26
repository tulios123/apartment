import { useEffect, useState } from 'react'

/**
 * Connectivity banner (audit UX-07). The app is online-only (the service worker
 * caches nothing), so without this an offline user just sees skeletons that never
 * resolve or scattered errors. A small fixed banner makes the state explicit.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      אין חיבור לאינטרנט — חלק מהנתונים עשויים לא להתעדכן.
    </div>
  )
}
