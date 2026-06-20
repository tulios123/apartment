import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Backspace, CircleNotch, Check, ArrowRight, CalendarBlank, Paperclip, X } from '@phosphor-icons/react'
import BottomSheet from '../ui/BottomSheet'
import CalendarPopover from '../ui/CalendarPopover'
import { createTransaction } from '../../hooks/useTransactions'
import { uploadDocument } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../lib/constants'
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

// RTL grid → bottom row reads: [⌫ right] [0 mid] [. left]
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', '.'] as const

function isoOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function ExpenseSheet({ open, onClose, initialDesc = '', initialAmount, onDone }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('אחר')
  const [touchedCat, setTouchedCat] = useState(false)
  const [payMethod, setPayMethod] = useState('')
  const [date, setDate] = useState(isoOffset(0))
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [receipt, setReceipt] = useState<File | null>(null)

  const [calOpen, setCalOpen] = useState(false)
  const descRef = useRef<HTMLInputElement>(null)
  const receiptRef = useRef<HTMLInputElement>(null)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])
  const [trackH, setTrackH] = useState<number>()

  const today = isoOffset(0)
  const yesterday = isoOffset(1)

  // Reset on each open.
  useEffect(() => {
    if (open) {
      setStep(1)
      setAmount(initialAmount ? String(initialAmount) : '')
      setDesc(initialDesc)
      setCategory(predictCategory(initialDesc))
      setTouchedCat(false)
      setPayMethod('')
      setDate(today)
      setState('idle')
      setReceipt(null)
    }
  }, [open, initialDesc, initialAmount, today])

  // Live-predict category from description until the user overrides it.
  useEffect(() => {
    if (!touchedCat) setCategory(predictCategory(desc))
  }, [desc, touchedCat])

  // Fix the sheet height to the TALLEST step so the slide never changes height.
  useLayoutEffect(() => {
    const h = stepRefs.current.reduce((m, el) => Math.max(m, el?.scrollHeight ?? 0), 0)
    if (h) setTrackH(h)
  }, [amount, desc, category, open])

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
  const dateLabel = date === today ? 'היום' : date === yesterday ? 'אתמול' : formatDate(date)

  async function save() {
    if (numeric <= 0 || state !== 'idle') return
    setState('saving')
    const { data: tx, error } = await createTransaction({
      contract_id: null, recurring_item_id: null, document_id: null,
      direction: 'expense', amount: numeric, date,
      category, description: desc.trim() || null, payment_method: payMethod || null,
    })
    if (error) { setState('idle'); return }

    // Attach the receipt (non-fatal): upload, create a document row, link it.
    if (receipt && tx) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const docId = crypto.randomUUID()
        const path = await uploadDocument(receipt, docId)
        await supabase.from('documents').insert({
          id: docId, owner_id: user?.id, property_id: null,
          contract_id: null, transaction_id: tx.id,
          type: 'receipt', name: receipt.name, storage_path: path, date,
        })
        await supabase.from('transactions').update({ document_id: docId }).eq('id', tx.id)
      } catch { /* receipt failed — the expense itself was saved */ }
    }

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
              המשך
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

            <span className="cap-fieldlabel">אופן תשלום</span>
            <div className="cap-chips">
              {PAYMENT_METHODS.filter(p => p.value).map(p => (
                <button
                  key={p.value}
                  className={`cap-chip${payMethod === p.value ? ' on' : ''}`}
                  onClick={() => setPayMethod(m => (m === p.value ? '' : p.value))}
                >{p.label}</button>
              ))}
            </div>

            <div className="cap-row-chips">
              <button type="button" className="cap-datechip" onClick={() => setCalOpen(true)}>
                <CalendarBlank size={18} weight="duotone" /> {dateLabel}
              </button>
              <button type="button" className={`cap-datechip${receipt ? ' on' : ''}`} onClick={() => receiptRef.current?.click()}>
                <Paperclip size={17} weight="bold" /> {receipt ? 'קבלה צורפה' : 'צרף קבלה'}
              </button>
              {receipt && (
                <button type="button" className="cap-receipt-clear" onClick={() => setReceipt(null)} aria-label="הסר קבלה">
                  <X size={15} weight="bold" />
                </button>
              )}
              <input ref={receiptRef} type="file" accept="image/*,.pdf,.heic" capture="environment"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setReceipt(f); e.target.value = '' }} />
            </div>
            <button className={`cap-save${state === 'done' ? ' ok' : ''}`} disabled={state !== 'idle'} onClick={save}>
              {state === 'saving' ? <CircleNotch className="spin" size={20} weight="bold" />
                : state === 'done' ? <><Check size={20} weight="bold" /> נשמר</>
                : 'שמירת הוצאה'}
            </button>
          </div>

        </div>
      </div>

      <CalendarPopover open={calOpen} value={date} max={today} onSelect={setDate} onClose={() => setCalOpen(false)} />
    </BottomSheet>
  )
}
