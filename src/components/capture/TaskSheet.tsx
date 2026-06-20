import { useEffect, useState } from 'react'
import { CircleNotch, Check, CalendarPlus, X } from '@phosphor-icons/react'
import BottomSheet from '../ui/BottomSheet'
import { createTask } from '../../hooks/useTasks'
import './capture.css'

type Props = {
  open: boolean
  onClose: () => void
  onDone: (label: string) => void
}

export default function TaskSheet({ open, onClose, onDone }: Props) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [showDate, setShowDate] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')

  useEffect(() => {
    if (open) { setTitle(''); setDue(''); setShowDate(false); setState('idle') }
  }, [open])

  const canSave = title.trim().length > 0 && state === 'idle'

  async function save() {
    if (!canSave) return
    setState('saving')
    const { error } = await createTask({
      property_id: null, recurring_item_id: null, transaction_id: null,
      title: title.trim(), due_date: due || null,
      category: 'כללי', status: 'open', source: 'manual',
      is_recurring: false, recurrence_days: null,
    })
    if (error) { setState('idle'); return }
    setState('done')
    onDone(due ? 'נוספה משימה לתזמון ✓' : 'נוספה לתוכנית העבודה ✓')
    setTimeout(onClose, 480)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="משימה חדשה">
      <input
        className="cap-title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save() }}
        placeholder="מה צריך לעשות?"
        autoFocus
      />

      {showDate ? (
        <div className="cap-date-row">
          <input className="cap-date" type="date" value={due} onChange={e => setDue(e.target.value)} autoFocus />
          <button className="cap-date-clear" onClick={() => { setDue(''); setShowDate(false) }} aria-label="הסר תאריך"><X size={18} /></button>
        </div>
      ) : (
        <button className="cap-ghost-date" onClick={() => setShowDate(true)}>
          <CalendarPlus size={18} weight="duotone" />
          ללא תאריך יעד · ייכנס לתוכנית העבודה
        </button>
      )}

      <button className={`cap-save${state === 'done' ? ' ok' : ''}`} disabled={!canSave && state === 'idle'} onClick={save}>
        {state === 'saving' ? <CircleNotch className="spin" size={20} weight="bold" />
          : state === 'done' ? <><Check size={20} weight="bold" /> נשמר</>
          : 'הוספת משימה'}
      </button>
    </BottomSheet>
  )
}
