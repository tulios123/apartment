import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Backspace, CircleNotch, Check, ArrowRight, CalendarBlank } from '@phosphor-icons/react'
import BottomSheet from '../ui/BottomSheet'
import { createTransaction } from '../../hooks/useTransactions'
import { EXPENSE_CATEGORIES } from '../../lib/constants'
import { predictCategory } from '../../lib/quickParse'
import { formatDate } from '../../lib/format'
import './capture.css'

type Props = {
  open: boolean
  onClose: () => void
  initialDesc?: string
  initialAmount?: number
  onDone: (label: string) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const

function isoOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function ExpenseSheet({ open, onClose, initialDesc = '', initialAmount, onDone }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('אחר')
  const [touchedCat, setTouchedCat] = useState(false)
  const [date, setDate] = useState(isoOffset(0))
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')

  const descRef = useRef<HTMLInputElement>(null)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])
  const [trackH, setTrackH] = useState<number>()

  const today = isoOffset(0)
  const yesterday = isoOffset(1)
  const dayBefore = isoOffset(2)

  // Reset on each open.
  useEffect(() => {
    if (open) {
      setStep(1)
      setAmount(initialAmount ? String(initialAmount) : '')
      setDesc(initialDesc)
      setCategory(predictCategory(initialDesc))
      setTouchedCat(false)
      setDate(today)
      setState('idle')
    }
  }, [open, initialDesc, initialAmount, today])

  // Live-predict category from description until the user overrides it.
  useEffect(() => {
    if (!touchedCat) setCategory(predictCategory(desc))
  }, [desc, touchedCat])

  // Morph the sheet height to the active step (keeps the keyboard's space honest).
  useLayoutEffect(() => {
    const el = stepRefs.current[step - 1]
    if (el) setTrackH(el.scrollHeight)
  }, [step, amount, desc, category, open])

  // Focus the description input only after the slide settles → no keyboard/layout thrash.
  useEffect(() => {
    if (step !== 2) return
    const t = setTimeout(() => descRef.current?.focus(), 380)
    return () => clearTimeout(t)
  }, [step])

  function press(k: string) {
    if (k === 'back') { setAmount(a => a.slice(0, -1)); return }
    if (k === '.' && amount.includes('.')) return
    if (k === '.' && amount === '') { setAmount('0.'); return }
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return
    setAmount(a => (a === '0' && k !== '.' ? k : a + k))
  }

  const numeric = Number(amount)
  const canContinue = numeric > 0
  const dateLabel = date === today ? 'היום' : date === yesterday ? 'אתמול' : date === dayBefore ? 'שלשום' : formatDate(date)

  async function save() {
    if (numeric <= 0 || state !== 'idle') return
    setState('saving')
    const { error } = await createTransaction({
      contract_id: null, recurring_item_id: null, document_id: null,
      direction: 'expense', amount: numeric, date,
      category, description: desc.trim() || null, payment_method: null,
    })
    if (error) { setState('idle'); return }
    setState('done')
    onDone(`נרשמה הוצאה · ₪${numeric.toLocaleString()}${desc.trim() ? ` · ${desc.trim()}` : ''}`)
    setTimeout(onClose, 480)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="הוצאה חדשה">
      <div className="cap-steps-wrap" style={trackH ? { height: trackH } : undefined}>
        <div className="cap-steps" style={{ direction: 'ltr', transform: `translateX(${(step - 1) * -100}%)` }}>

          {/* ── Step 1: amount + numpad ── */}
          <div className="cap-step" dir="rtl" ref={el => { stepRefs.current[0] = el }} aria-hidden={step !== 1}>
            <div className="cap-amount">
              <span className="cap-amount-cur">₪</span>
              <span className={`cap-amount-val${amount ? '' : ' ph'}`}>{amount || '0'}</span>
            </div>
            <div className="numpad">
              {KEYS.map(k => (
                <button key={k} className={`numkey${k === 'back' ? ' fn' : ''}`} onClick={() => press(k)}>
                  {k === 'back' ? <Backspace size={22} /> : k}
                </button>
              ))}
            </div>
            <button className="cap-save" disabled={!canContinue} onClick={() => setStep(2)}>
              המשך <ArrowRight size={18} weight="bold" />
            </button>
          </div>

          {/* ── Step 2: context + category + date ── */}
          <div className="cap-step" dir="rtl" ref={el => { stepRefs.current[1] = el }} aria-hidden={step !== 2}>
            <button className="cap-back" onClick={() => setStep(1)}>
              <ArrowRight size={16} weight="bold" /> {`₪${numeric.toLocaleString()}`}
            </button>
            <input
              ref={descRef}
              className="cap-desc"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder="על מה? (למשל: תיקון ברז)"
            />
            <div className="cap-chips">
              {EXPENSE_CATEGORIES.map(c => (
                <button
                  key={c}
                  className={`cap-chip${category === c ? ' on' : ''}`}
                  onClick={() => { setCategory(c); setTouchedCat(true) }}
                >{c}</button>
              ))}
            </div>
            <button className="cap-datechip" onClick={() => setStep(3)}>
              <CalendarBlank size={16} weight="duotone" /> {dateLabel}
            </button>
            <button className={`cap-save${state === 'done' ? ' ok' : ''}`} disabled={state !== 'idle'} onClick={save}>
              {state === 'saving' ? <CircleNotch className="spin" size={20} weight="bold" />
                : state === 'done' ? <><Check size={20} weight="bold" /> נשמר</>
                : 'שמירת הוצאה'}
            </button>
          </div>

          {/* ── Step 3: date fallback ── */}
          <div className="cap-step" dir="rtl" ref={el => { stepRefs.current[2] = el }} aria-hidden={step !== 3}>
            <button className="cap-back" onClick={() => setStep(2)}>
              <ArrowRight size={16} weight="bold" /> מתי זה היה?
            </button>
            <div className="cap-date-opts">
              <button className={`cap-dateopt${date === today ? ' on' : ''}`} onClick={() => { setDate(today); setStep(2) }}>היום</button>
              <button className={`cap-dateopt${date === yesterday ? ' on' : ''}`} onClick={() => { setDate(yesterday); setStep(2) }}>אתמול</button>
              <button className={`cap-dateopt${date === dayBefore ? ' on' : ''}`} onClick={() => { setDate(dayBefore); setStep(2) }}>שלשום</button>
            </div>
            <label className={`cap-date-custom${date !== today && date !== yesterday && date !== dayBefore ? ' on' : ''}`}>
              <span className="cap-date-custom-label">
                <CalendarBlank size={18} weight="duotone" />
                {date !== today && date !== yesterday && date !== dayBefore ? formatDate(date) : 'תאריך אחר…'}
              </span>
              <ArrowRight size={16} weight="bold" className="cap-date-custom-chev" />
              <input type="date" value={date} max={today} onChange={e => { setDate(e.target.value); setStep(2) }} />
            </label>
          </div>

        </div>
      </div>
    </BottomSheet>
  )
}
