import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CaretRight, CaretLeft } from '@phosphor-icons/react'
import { parseLocalISO } from '../../lib/format'
import './calendar-popover.css'

type Props = {
  open: boolean
  value: string            // yyyy-mm-dd or ''
  onSelect: (date: string) => void
  onClose: () => void
  min?: string             // yyyy-mm-dd — days before this are disabled
  max?: string             // yyyy-mm-dd — days after this are disabled
}

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

const isoLocal = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export default function CalendarPopover({ open, value, onSelect, onClose, min, max }: Props) {
  const base = value ? parseLocalISO(value) : new Date()
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() })

  // Each time the popover opens, jump to the selected date's month — not wherever
  // the user last navigated to in a previous open.
  useEffect(() => {
    if (!open) return
    const b = value ? parseLocalISO(value) : new Date()
    setView({ y: b.getFullYear(), m: b.getMonth() })
  }, [open, value])

  if (!open) return null

  const now = new Date()
  const todayIso = isoLocal(now.getFullYear(), now.getMonth(), now.getDate())
  const startDow = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()

  function shift(delta: number) {
    setView(v => {
      const m = v.m + delta
      if (m < 0) return { y: v.y - 1, m: 11 }
      if (m > 11) return { y: v.y + 1, m: 0 }
      return { y: v.y, m }
    })
  }

  function pick(day: number) {
    onSelect(isoLocal(view.y, view.m, day))
    onClose()
  }

  return createPortal(
    <div className="calpop-scrim" onClick={onClose}>
      <div className="calpop" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="calpop-head">
          <button className="calpop-nav" onClick={() => shift(1)} aria-label="חודש הבא"><CaretLeft size={18} weight="bold" /></button>
          <span className="calpop-title">{MONTHS[view.m]} {view.y}</span>
          <button className="calpop-nav" onClick={() => shift(-1)} aria-label="חודש קודם"><CaretRight size={18} weight="bold" /></button>
        </div>

        <div className="calpop-grid">
          {WD.map(d => <span key={d} className="calpop-wd">{d}</span>)}
          {Array.from({ length: startDow }).map((_, i) => <span key={`b${i}`} className="calpop-day blank" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const iso = isoLocal(view.y, view.m, day)
            const disabled = (max != null && iso > max) || (min != null && iso < min)
            const cls = `calpop-day${iso === value ? ' sel' : ''}${iso === todayIso ? ' today' : ''}${disabled ? ' disabled' : ''}`
            return <button key={day} className={cls} disabled={disabled} onClick={() => pick(day)}>{day}</button>
          })}
        </div>

        <div className="calpop-actions">
          <button className="calpop-today-btn" onClick={() => { onSelect(todayIso); onClose() }}>היום</button>
          <button className="calpop-close-btn" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
