import { ArrowsClockwise } from '@phosphor-icons/react'
import { useVersionCheck } from '../hooks/useVersionCheck'
import './update-banner.css'

/**
 * Shown when a newer deploy exists than the running bundle — the elegant fix for the
 * recurring "I'm looking at a stale app" problem. A calm pill above the bottom nav;
 * one tap reloads onto the fresh build. Auto-hides when already up to date.
 */
export default function UpdateBanner() {
  const { updateAvailable } = useVersionCheck()
  if (!updateAvailable) return null
  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner-text">
        <ArrowsClockwise size={16} weight="bold" /> גרסה חדשה זמינה
      </span>
      <button className="update-banner-btn" onClick={() => window.location.reload()}>רענון</button>
    </div>
  )
}
