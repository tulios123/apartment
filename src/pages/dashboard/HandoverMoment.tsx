import { useState } from 'react'
import { Key, X, CaretLeft } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { daysBetween, formatDate } from '../../lib/format'

/** How long after handover the greeting stays available, for someone who didn't open
 *  the app that day. Beyond this it would be news about something long past. */
const WINDOW_DAYS = 14

const dismissKey = (propertyId: string, keyDate: string) => `handover-seen:${propertyId}:${keyDate}`

/**
 * The one moment worth marking in this whole stage.
 *
 * Everything else about the pre-key experience is quiet by design, but the day the keys
 * arrive is a genuine peak — and by the peak-end rule it is what the months of waiting
 * will be remembered by. It is also the day the app silently becomes a different tool:
 * the stage derives itself from the date, so without a word the countdown card would
 * simply vanish and be replaced by a monthly cycle, with nothing to explain why.
 *
 * Deliberately not a modal. It congratulates, says what changed, offers the next step,
 * and can be dismissed — a person collecting keys does not need to be interrupted.
 */
export function HandoverMoment({ propertyId, keyDate, today, hasLease }: {
  propertyId: string
  keyDate: string
  today: string
  hasLease: boolean
}) {
  const navigate = useNavigate()
  const storageKey = dismissKey(propertyId, keyDate)
  const [dismissed, setDismissed] = useState(() => {
    // Per-device, and that is fine for a greeting: the worst case is seeing it once more
    // on a second device, which beats storing UI state in the money database.
    try { return localStorage.getItem(storageKey) === '1' } catch { return false }
  })

  const sinceHandover = daysBetween(keyDate, today)
  if (dismissed || sinceHandover < 0 || sinceHandover > WINDOW_DAYS) return null

  function dismiss() {
    try { localStorage.setItem(storageKey, '1') } catch { /* private mode — just hide it */ }
    setDismissed(true)
  }

  return (
    <div className="hs-handover">
      <button type="button" className="hs-handover-close" onClick={dismiss} aria-label="סגירה">
        <X size={16} weight="bold" />
      </button>
      <div className="hs-handover-icon"><Key size={24} weight="duotone" /></div>
      <div className="hs-handover-body">
        <div className="hs-handover-title">
          {sinceHandover === 0 ? 'המפתח שלך — מהיום הדירה ברשותך' : 'הדירה ברשותך'}
        </div>
        <p className="hs-handover-text">
          {sinceHandover === 0 ? 'מסירה היום' : formatDate(keyDate)}
          {' · '}
          מכאן המעקב החודשי מתחיל.
        </p>
        {!hasLease && (
          <button type="button" className="hs-handover-cta" onClick={() => navigate('/property/rental')}>
            הוסיפו חוזה שכירות <CaretLeft size={13} weight="bold" />
          </button>
        )}
      </div>
    </div>
  )
}
