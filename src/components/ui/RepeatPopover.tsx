import { createPortal } from 'react-dom'
import { Check } from '@phosphor-icons/react'
import { RECURRENCE_OPTIONS } from '../../lib/recurrence'
import './calendar-popover.css'

type Props = {
  open: boolean
  value: number | null       // stored recurrence_days value, or null for "no repeat"
  onSelect: (value: number | null) => void
  onClose: () => void
}

/** A small in-app repeat picker — a centered card like CalendarPopover, so the
 *  phone's own full-screen <select> wheel never takes over the sheet (owner #31). */
export default function RepeatPopover({ open, value, onSelect, onClose }: Props) {
  if (!open) return null

  return createPortal(
    <div className="calpop-scrim" onClick={onClose}>
      <div className="calpop repeatpop" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="calpop-head"><span className="calpop-title">חזרה</span></div>
        <div className="repeatpop-list">
          {RECURRENCE_OPTIONS.map(o => {
            const sel = (o.value ?? null) === value
            return (
              <button
                key={o.label}
                type="button"
                className={`repeatpop-opt${sel ? ' sel' : ''}`}
                onClick={() => { onSelect(o.value ?? null); onClose() }}
              >
                <span>{o.label}</span>
                {sel && <Check size={18} weight="bold" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
