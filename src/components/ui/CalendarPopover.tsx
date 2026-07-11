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
  /**
   * Extra controls rendered below the day grid — used by the task sheet to place
   * "set time" + "repeat" inside the date picker (Google-Tasks "Date & Time" sheet).
   * When present, picking a day keeps the popover open (so time/repeat can follow)
   * and the close action reads "סיום" instead of "סגור".
   */
  footer?: React.ReactNode
}

type ViewMode = 'days' | 'months' | 'years'

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const MONTHS_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const YEAR_PAGE_SIZE = 12

const isoLocal = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export default function CalendarPopover({ open, value, onSelect, onClose, min, max, footer }: Props) {
  const base = value ? parseLocalISO(value) : new Date()
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() })
  const [mode, setMode] = useState<ViewMode>('days')

  // Each time the popover opens, jump to the selected date's month — not wherever
  // the user last navigated to in a previous open — and back to the day grid.
  useEffect(() => {
    if (!open) return
    const b = value ? parseLocalISO(value) : new Date()
    setView({ y: b.getFullYear(), m: b.getMonth() })
    setMode('days')
  }, [open, value])

  if (!open) return null

  const now = new Date()
  const todayIso = isoLocal(now.getFullYear(), now.getMonth(), now.getDate())
  const startDow = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const yearPageStart = Math.floor(view.y / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE

  function shiftDays(delta: number) {
    setView(v => {
      const m = v.m + delta
      if (m < 0) return { y: v.y - 1, m: 11 }
      if (m > 11) return { y: v.y + 1, m: 0 }
      return { y: v.y, m }
    })
  }

  function shiftYears(delta: number) {
    setView(v => ({ ...v, y: v.y + delta }))
  }

  function navPrev() {
    if (mode === 'days') shiftDays(-1)
    else shiftYears(mode === 'months' ? -1 : -YEAR_PAGE_SIZE)
  }

  function navNext() {
    if (mode === 'days') shiftDays(1)
    else shiftYears(mode === 'months' ? 1 : YEAR_PAGE_SIZE)
  }

  function pickDay(day: number) {
    onSelect(isoLocal(view.y, view.m, day))
    // With a footer (time/repeat), stay open so the owner can keep tuning the
    // due date — "סיום" closes it. Without one, a pick is the whole interaction.
    if (!footer) onClose()
  }

  function pickMonth(m: number) {
    setView(v => ({ ...v, m }))
    setMode('days')
  }

  function pickYear(y: number) {
    setView(v => ({ ...v, y }))
    setMode('months')
  }

  const navPrevLabel = mode === 'days' ? 'חודש קודם' : mode === 'months' ? 'שנה קודמת' : 'עשור קודם'
  const navNextLabel = mode === 'days' ? 'חודש הבא' : mode === 'months' ? 'שנה הבאה' : 'עשור הבא'

  return createPortal(
    <div className="calpop-scrim" onClick={onClose}>
      <div className="calpop" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="calpop-head">
          <button className="calpop-nav" onClick={navNext} aria-label={navNextLabel}><CaretLeft size={18} weight="bold" /></button>
          {mode === 'years' ? (
            <span className="calpop-title">{yearPageStart}–{yearPageStart + YEAR_PAGE_SIZE - 1}</span>
          ) : (
            <button type="button" className="calpop-title calpop-title-btn" onClick={() => setMode('years')}>
              {mode === 'months' ? view.y : `${MONTHS[view.m]} ${view.y}`}
            </button>
          )}
          <button className="calpop-nav" onClick={navPrev} aria-label={navPrevLabel}><CaretRight size={18} weight="bold" /></button>
        </div>

        {mode === 'days' && (
          <div className="calpop-grid">
            {WD.map(d => <span key={d} className="calpop-wd">{d}</span>)}
            {Array.from({ length: startDow }).map((_, i) => <span key={`b${i}`} className="calpop-day blank" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const iso = isoLocal(view.y, view.m, day)
              const disabled = (max != null && iso > max) || (min != null && iso < min)
              const cls = `calpop-day${iso === value ? ' sel' : ''}${iso === todayIso ? ' today' : ''}${disabled ? ' disabled' : ''}`
              return <button key={day} className={cls} disabled={disabled} onClick={() => pickDay(day)}>{day}</button>
            })}
          </div>
        )}

        {mode === 'months' && (
          <div className="calpop-grid-flat">
            {MONTHS_SHORT.map((label, m) => {
              const isSel = value !== '' && base.getFullYear() === view.y && base.getMonth() === m
              const isToday = now.getFullYear() === view.y && now.getMonth() === m
              const cls = `calpop-cell${isSel ? ' sel' : ''}${isToday ? ' today' : ''}`
              return <button key={label} className={cls} onClick={() => pickMonth(m)}>{label}</button>
            })}
          </div>
        )}

        {mode === 'years' && (
          <div className="calpop-grid-flat">
            {Array.from({ length: YEAR_PAGE_SIZE }).map((_, i) => {
              const y = yearPageStart + i
              const isSel = value !== '' && base.getFullYear() === y
              const isToday = now.getFullYear() === y
              const cls = `calpop-cell${isSel ? ' sel' : ''}${isToday ? ' today' : ''}`
              return <button key={y} className={cls} onClick={() => pickYear(y)}>{y}</button>
            })}
          </div>
        )}

        {footer && mode === 'days' && value !== '' && (
          <div className="calpop-footer">{footer}</div>
        )}

        <div className="calpop-actions">
          <button className="calpop-close-btn" onClick={onClose}>{footer ? 'סיום' : 'סגור'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
