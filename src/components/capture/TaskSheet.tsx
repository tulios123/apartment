import { useEffect, useRef, useState } from 'react'
import { CircleNotch, Check, CalendarBlank, Clock, X, ArrowsClockwise } from '@phosphor-icons/react'
import BottomSheet from '../ui/BottomSheet'
import CalendarPopover from '../ui/CalendarPopover'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { shouldConfirmDiscard } from '../../lib/discardGuard'
import { createTask } from '../../hooks/useTasks'
import { formatDate } from '../../lib/format'
import { RECURRENCE_OPTIONS, recurrenceLabel } from '../../lib/recurrence'
import { tap } from '../../lib/haptics'
import './capture.css'

type Props = {
  open: boolean
  onClose: () => void
  onDone: (label: string) => void
}

export default function TaskSheet({ open, onClose, onDone }: Props) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [time, setTime] = useState('')
  const [repeat, setRepeat] = useState<number | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(''); setDue(''); setTime(''); setRepeat(null); setCalOpen(false); setState('idle'); setErr(null); setConfirmDiscard(false)
      // Pop the keyboard as soon as the sheet mounts (like Google Tasks). `autoFocus`
      // alone is unreliable once the sheet animates in, so focus once more next frame.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  async function save() {
    if (state !== 'idle') return
    // Active button + a clear reason beats a silent greyed-out one.
    if (!title.trim()) { setErr('יש להזין כותרת למשימה'); return }
    setErr(null)
    setState('saving')
    const { error } = await createTask({
      property_id: null, recurring_item_id: null, transaction_id: null,
      title: title.trim(), due_date: due || null, due_time: (due && time) ? time : null,
      category: 'כללי', status: 'open', source: 'manual',
      // Repeat only means something with an anchor date — drop it if the date was cleared.
      is_recurring: !!(due && repeat), recurrence_days: (due && repeat) ? repeat : null,
    })
    if (error) { setState('idle'); setErr('לא הצלחנו לשמור — נסו שוב'); return }
    setState('done')
    tap(18)
    onDone(due ? `נוספה משימה לתזמון${time ? ` · ${time}` : ''} ✓` : 'נוספה לתוכנית העבודה ✓')
    setTimeout(onClose, 480)
  }

  // Once anything is entered, a scrim-tap / Esc / swipe-down / X shouldn't silently
  // throw the draft away. Match Google Tasks: ask before discarding (owner request #28).
  const hasData = title.trim() !== '' || due !== ''
  function requestClose() {
    if (confirmDiscard) return // Esc/scrim while the discard dialog is up — let it handle itself.
    if (shouldConfirmDiscard(hasData, state)) setConfirmDiscard(true)
    else onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} onDismiss={requestClose} title="משימה חדשה" minimizable={false}>
      <input
        ref={inputRef}
        className="cap-title"
        value={title}
        onChange={e => { if (err) setErr(null); setTitle(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') save() }}
        placeholder="מה צריך לעשות?"
        autoFocus
      />

      {due ? (
        <div className="cap-date-row">
          <button className="cap-datechip on" type="button" onClick={() => setCalOpen(true)}>
            <CalendarBlank size={18} weight="duotone" />
            <span>{formatDate(due)}{time ? ` · ${time}` : ''}{repeat ? ` · ${recurrenceLabel(repeat)}` : ''}</span>
          </button>
          <button className="cap-date-clear" onClick={() => { setDue(''); setTime(''); setRepeat(null) }} aria-label="הסר תאריך"><X size={18} /></button>
        </div>
      ) : (
        // Google-Tasks affordance: a small clock (השעון הקטן) opens the "date & time"
        // picker. No date is fine — the task simply lands in the work plan.
        <button className="cap-clockbtn" onClick={() => setCalOpen(true)}>
          <Clock size={19} weight="regular" />
          <span>הוסף תאריך ושעה</span>
        </button>
      )}

      {err && <p className="cap-error" role="alert">{err}</p>}
      <button className={`cap-save${state === 'done' ? ' ok' : ''}`} disabled={state !== 'idle'} onClick={save}>
        {state === 'saving' ? <CircleNotch className="spin" size={20} weight="bold" />
          : state === 'done' ? <><Check size={20} weight="bold" /> נשמר</>
          : 'הוספת משימה'}
      </button>

      <CalendarPopover
        open={calOpen}
        value={due}
        onSelect={setDue}
        onClose={() => setCalOpen(false)}
        footer={
          <>
            {/* Set-time row — native <input type=time> so the phone shows its wheel. */}
            <label className={`cap-timechip${time ? ' on' : ''}`}>
              <Clock size={17} weight="duotone" />
              <span>{time || 'הוסף שעה'}</span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="שעת יעד" />
            </label>
            {/* Repeat row — native <select> wheel, mirroring Google's "Does not repeat". */}
            <label className={`cap-repeat${repeat ? ' on' : ''}`}>
              <ArrowsClockwise size={17} weight="duotone" />
              <select value={repeat ?? ''} onChange={e => setRepeat(e.target.value ? Number(e.target.value) : null)} aria-label="חזרה">
                {RECURRENCE_OPTIONS.map(o => <option key={o.label} value={o.value ?? ''}>{o.label}</option>)}
              </select>
            </label>
          </>
        }
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="למחוק את המשימה?"
        message="הפרטים שהוזנו יימחקו."
        confirmLabel="מחיקה"
        cancelLabel="המשך עריכה"
        tone="danger"
        onConfirm={() => { setConfirmDiscard(false); onClose() }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </BottomSheet>
  )
}
