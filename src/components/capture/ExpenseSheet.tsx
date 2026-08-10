import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Backspace, CircleNotch, Check, ArrowRight, CalendarBlank, Paperclip, X } from '@phosphor-icons/react'
import BottomSheet from '../ui/BottomSheet'
import CalendarPopover from '../ui/CalendarPopover'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { shouldConfirmDiscard } from '../../lib/discardGuard'
import { createTransaction } from '../../hooks/useTransactions'
import { uploadDocument, MAX_UPLOAD_BYTES } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../lib/constants'
import { predictCategory } from '../../lib/quickParse'
import { formatDate, monthDayISO } from '../../lib/format'
import { tap } from '../../lib/haptics'
import './capture.css'

type Props = {
  open: boolean
  onClose: () => void
  initialDesc?: string
  initialAmount?: number
  /** Bumped by the parent to restore the sheet from its docked (minimized) state (V3). */
  expandKey?: number
  onDone: (label: string) => void
}

// Universal phone-keypad order (golden #4): the grid is forced LTR in CSS so
// "1" sits top-LEFT like every dialer/calculator; bottom row [. 0 ⌫] keeps
// the backspace at the bottom-right thumb corner.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const

// Up to 8 integer digits — matches the DB column amount numeric(10,2) (max
// 99,999,999.99). A 9th digit overflowed the column so the insert always failed with a
// misleading "נסו שוב"; capping the keypad prevents an unsavable amount up front.
const MAX_INT_DIGITS = 8

// Group the integer part for the live hero ("1234567" → "1,234,567") while keeping any
// trailing dot / partial decimals intact so it reads naturally mid-typing.
function groupAmount(s: string): string {
  const [int, dec] = s.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${grouped}.${dec}` : grouped
}

function isoOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return monthDayISO(d)   // local Y-M-D (SW-08: one shared definition in lib/format)
}

export default function ExpenseSheet({ open, onClose, initialDesc = '', initialAmount, expandKey, onDone }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('אחר')
  const [touchedCat, setTouchedCat] = useState(false)
  const [payMethod, setPayMethod] = useState('')
  const [date, setDate] = useState(isoOffset(0))
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const [calOpen, setCalOpen] = useState(false)
  const descRef = useRef<HTMLInputElement>(null)
  const receiptRef = useRef<HTMLInputElement>(null)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])
  const [trackH, setTrackH] = useState<number>()
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backCleared = useRef(false)

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
      setErr(null)
      setReceipt(null)
      setConfirmDiscard(false)
    }
  }, [open, initialDesc, initialAmount, today])

  // Live-predict category from description until the user overrides it.
  useEffect(() => {
    if (!touchedCat) setCategory(predictCategory(desc))
  }, [desc, touchedCat])

  // Fix the sheet height to the TALLEST step so the slide never changes height.
  // Measure only on open / step change — neither step's height changes while typing,
  // so depending on amount/desc would force a synchronous reflow on every keystroke.
  useLayoutEffect(() => {
    const h = stepRefs.current.reduce((m, el) => Math.max(m, el?.scrollHeight ?? 0), 0)
    if (h) setTrackH(h)
  }, [open, step])

  // UX-01: deliberately NOT auto-focusing the description on step 2. Auto-focus pops
  // the iOS keyboard over the category/payment/date chips and the save button — a
  // keyboard trap — and the user explicitly dislikes the keyboard opening on its own.
  // They tap the field when they want to type; the chips stay reachable.

  function press(k: string) {
    if (err) setErr(null)
    tap()
    if (k === 'back') {
      // A long-press already cleared the field — swallow the trailing click.
      if (backCleared.current) { backCleared.current = false; return }
      setAmount(a => a.slice(0, -1)); return
    }
    if (k === '.') {
      if (amount.includes('.')) return
      setAmount(a => (a === '' ? '0.' : a + '.')); return
    }
    // digit: max 2 decimals, and cap the integer part so the hero never overflows.
    if (amount.includes('.')) {
      if (amount.split('.')[1]?.length >= 2) return
    } else if (amount !== '0' && amount.length >= MAX_INT_DIGITS) {
      return
    }
    setAmount(a => (a === '0' ? k : a + k))
  }

  // Long-press backspace = clear the whole amount (works on every platform).
  function backHoldStart() {
    // EDGE-16: start each press sequence clean, so a prior long-press whose trailing
    // click never fired can't leave backCleared=true and swallow this backspace.
    backCleared.current = false
    backTimer.current = setTimeout(() => { backCleared.current = true; setAmount(''); tap(18) }, 450)
  }
  function backHoldEnd() {
    if (backTimer.current) { clearTimeout(backTimer.current); backTimer.current = null }
  }

  const numeric = Number(amount)
  const canContinue = numeric > 0

  // Keep "המשך" tappable so it's never a silent dead button — tell the user why
  // it can't proceed (no amount) instead of leaving them stuck on a greyed button.
  function goStep2() {
    if (!canContinue) { setErr('יש להזין סכום כדי להמשיך'); return }
    setErr(null)
    setStep(2)
  }
  // A gesture-dismiss (scrim/swipe/Esc) shouldn't silently drop what was entered; ask
  // first when there's data. The X closes at once (deliberate). An untouched sheet closes
  // silently either way.
  const hasData = amount !== '' || desc.trim() !== '' || receipt !== null
  function requestClose() {
    if (confirmDiscard) return
    if (shouldConfirmDiscard(hasData, state)) setConfirmDiscard(true)
    else onClose()
  }
  const dateLabel = date === today ? 'היום' : date === yesterday ? 'אתמול' : formatDate(date)

  async function save() {
    if (numeric <= 0 || state !== 'idle') return
    setErr(null)
    setState('saving')
    const { data: tx, error } = await createTransaction({
      contract_id: null, recurring_item_id: null, document_id: null,
      direction: 'expense', amount: numeric, date,
      category, description: desc.trim() || null, payment_method: payMethod || null,
    })
    if (error) { setState('idle'); setErr('לא הצלחנו לשמור — נסו שוב'); return }

    // Attach the receipt (non-fatal): upload, create a document row, link it.
    // C7-A: a failure here used to be swallowed silently while the expense showed
    // "נשמר ✓" — the user believed the receipt was attached. Surface it instead.
    let receiptFailed = false
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
      } catch {
        // The expense itself was saved — flag so the user knows to re-attach.
        receiptFailed = true
      }
    }

    setState('done')
    tap(18)
    onDone(receiptFailed
      ? `ההוצאה נשמרה, אך הקבלה לא צורפה — נסו שוב מהמסך`
      : `נרשמה הוצאה · ₪${numeric.toLocaleString()}${desc.trim() ? ` · ${desc.trim()}` : ''}`)
    setTimeout(onClose, 480)
  }

  return (
    <BottomSheet open={open} onClose={onClose} onDismiss={requestClose} title="הוצאה חדשה" minimizable={false} expandKey={expandKey}>
      <div className="cap-steps-wrap" style={trackH ? { height: trackH } : undefined}>
        <div className="cap-steps" style={{ direction: 'ltr', transform: `translateX(${(step - 1) * -100}%)` }}>

          {/* ── Step 1: amount + numpad ── */}
          <div className="cap-step" dir="rtl" ref={el => { stepRefs.current[0] = el }} aria-hidden={step !== 1}>
            <div className="cap-amount">
              <span className="cap-amount-cur">₪</span>
              <span className={`cap-amount-val${amount ? '' : ' ph'}`}>{amount ? groupAmount(amount) : '0'}</span>
            </div>
            <div className="numpad">
              {KEYS.map(k => (
                <button
                  key={k}
                  className={`numkey${k === 'back' ? ' fn' : ''}`}
                  onClick={() => press(k)}
                  {...(k === 'back' ? {
                    onPointerDown: backHoldStart,
                    onPointerUp: backHoldEnd,
                    onPointerLeave: backHoldEnd,
                  } : {})}
                >
                  {k === 'back' ? <Backspace size={22} /> : k}
                </button>
              ))}
            </div>
            {err && <p className="cap-error" role="alert">{err}</p>}
            <button className="cap-save" disabled={state !== 'idle'} onClick={goStep2}>
              המשך
            </button>
          </div>

          {/* ── Step 2: context + category + date ── */}
          <div className="cap-step" dir="rtl" ref={el => { stepRefs.current[1] = el }} aria-hidden={step !== 2}>
            <button className="cap-back" onClick={() => setStep(1)}>
              <ArrowRight size={16} weight="bold" /> {`₪${numeric.toLocaleString()}`}
            </button>
            <span className="cap-fieldlabel">תיאור</span>
            <input
              ref={descRef}
              aria-label="תיאור ההוצאה"
              className="cap-desc"
              value={desc}
              onChange={e => { if (err) setErr(null); setDesc(e.target.value) }}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder="על מה? (למשל: תיקון ברז)"
            />
            <span className="cap-fieldlabel">קטגוריה</span>
            <div className="cap-chips">
              {EXPENSE_CATEGORIES.map(c => (
                <button
                  key={c}
                  className={`cap-chip${category === c ? ' on' : ''}`}
                  onClick={() => { setCategory(c); setTouchedCat(true) }}
                >{c}</button>
              ))}
            </div>

            <span className="cap-fieldlabel">אמצעי תשלום</span>
            <div className="cap-chips">
              {PAYMENT_METHODS.filter(p => p.value).map(p => (
                <button
                  key={p.value}
                  className={`cap-chip${payMethod === p.value ? ' on' : ''}`}
                  onClick={() => setPayMethod(m => (m === p.value ? '' : p.value))}
                >{p.label}</button>
              ))}
            </div>

            <span className="cap-fieldlabel">תאריך</span>
            <div className="cap-chips">
              <button type="button" className={`cap-chip${date === today ? ' on' : ''}`} onClick={() => { tap(); setDate(today) }}>היום</button>
              <button type="button" className={`cap-chip${date === yesterday ? ' on' : ''}`} onClick={() => { tap(); setDate(yesterday) }}>אתמול</button>
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
              <input ref={receiptRef} type="file" accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  // EDGE-17: reject oversized receipts up front with a clear message.
                  if (f && f.size > MAX_UPLOAD_BYTES) setErr('הקובץ גדול מדי (עד 15MB)')
                  else if (f) { setErr(null); setReceipt(f) }
                  e.target.value = ''
                }} />
            </div>
            {err && <p className="cap-error" role="alert">{err}</p>}
            <button className={`cap-save${state === 'done' ? ' ok' : ''}`} disabled={state !== 'idle'} onClick={save}>
              {state === 'saving' ? <CircleNotch className="spin" size={20} weight="bold" />
                : state === 'done' ? <><Check size={20} weight="bold" /> נשמר</>
                : 'שמירת הוצאה'}
            </button>
          </div>

        </div>
      </div>

      <CalendarPopover open={calOpen} value={date} max={today} onSelect={setDate} onClose={() => setCalOpen(false)} />

      <ConfirmDialog
        open={confirmDiscard}
        title="לצאת בלי לשמור?"
        message="מה שהוזן לא יישמר."
        confirmLabel="יציאה" cancelLabel="המשך עריכה" tone="danger"
        onConfirm={() => { setConfirmDiscard(false); onClose() }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </BottomSheet>
  )
}
