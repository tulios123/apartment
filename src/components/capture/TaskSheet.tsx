import { useEffect, useState } from 'react'
import { CircleNotch, Check, CalendarPlus, CalendarBlank, Clock, X } from '@phosphor-icons/react'
import BottomSheet from '../ui/BottomSheet'
import CalendarPopover from '../ui/CalendarPopover'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { shouldConfirmDiscard } from './discardGuard'
import { createTask } from '../../hooks/useTasks'
import { formatDate } from '../../lib/format'
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
  const [calOpen, setCalOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (open) { setTitle(''); setDue(''); setTime(''); setCalOpen(false); setState('idle'); setErr(null); setConfirmDiscard(false) }
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
      is_recurring: false, recurrence_days: null,
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
    <BottomSheet open={open} onClose={requestClose} title="משימה חדשה" minimizable={false}>
      <input
        className="cap-title"
        value={title}
        onChange={e => { if (err) setErr(null); setTitle(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') save() }}
        placeholder="מה צריך לעשות?"
        autoFocus
      />

      {due ? (
        <div className="cap-date-row">
          <button className="cap-datechip" type="button" onClick={() => setCalOpen(true)}>
            <CalendarBlank size={18} weight="duotone" /> {formatDate(due)}
          </button>
          <label className={`cap-timechip${time ? ' on' : ''}`}>
            <Clock size={17} weight="duotone" />
            <span>{time || 'הוסף שעה'}</span>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="שעת יעד" />
          </label>
          <button className="cap-date-clear" onClick={() => { setDue(''); setTime('') }} aria-label="הסר תאריך"><X size={18} /></button>
        </div>
      ) : (
        <button className="cap-ghost-date" onClick={() => setCalOpen(true)}>
          <CalendarPlus size={18} weight="duotone" />
          ללא תאריך יעד · ייכנס לתוכנית העבודה
        </button>
      )}

      {err && <p className="cap-error" role="alert">{err}</p>}
      <button className={`cap-save${state === 'done' ? ' ok' : ''}`} disabled={state !== 'idle'} onClick={save}>
        {state === 'saving' ? <CircleNotch className="spin" size={20} weight="bold" />
          : state === 'done' ? <><Check size={20} weight="bold" /> נשמר</>
          : 'הוספת משימה'}
      </button>

      <CalendarPopover open={calOpen} value={due} onSelect={setDue} onClose={() => setCalOpen(false)} />

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
