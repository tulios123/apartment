import { useEffect, useState } from 'react'
import { Backspace, CircleNotch, Check } from '@phosphor-icons/react'
import BottomSheet from '../ui/BottomSheet'
import { createTransaction } from '../../hooks/useTransactions'
import { EXPENSE_CATEGORIES } from '../../lib/constants'
import { predictCategory } from '../../lib/quickParse'
import './capture.css'

type Props = {
  open: boolean
  onClose: () => void
  initialDesc?: string
  initialAmount?: number
  onDone: (label: string) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const

export default function ExpenseSheet({ open, onClose, initialDesc = '', initialAmount, onDone }: Props) {
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('אחר')
  const [touchedCat, setTouchedCat] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')

  // Reset on each open.
  useEffect(() => {
    if (open) {
      setAmount(initialAmount ? String(initialAmount) : '')
      setDesc(initialDesc)
      setCategory(predictCategory(initialDesc))
      setTouchedCat(false)
      setState('idle')
    }
  }, [open, initialDesc, initialAmount])

  // Live-predict category from description until the user overrides it.
  useEffect(() => {
    if (!touchedCat) setCategory(predictCategory(desc))
  }, [desc, touchedCat])

  function press(k: string) {
    if (k === 'back') { setAmount(a => a.slice(0, -1)); return }
    if (k === '.' && amount.includes('.')) return
    if (k === '.' && amount === '') { setAmount('0.'); return }
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return
    setAmount(a => (a === '0' && k !== '.' ? k : a + k))
  }

  const numeric = Number(amount)
  const canSave = numeric > 0 && state === 'idle'

  async function save() {
    if (!canSave) return
    setState('saving')
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await createTransaction({
      contract_id: null, recurring_item_id: null, document_id: null,
      direction: 'expense', amount: numeric, date: today,
      category, description: desc.trim() || null, payment_method: null,
    })
    if (error) { setState('idle'); return }
    setState('done')
    onDone(`נרשמה הוצאה · ₪${numeric.toLocaleString()}${desc.trim() ? ` · ${desc.trim()}` : ''}`)
    setTimeout(onClose, 480)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="הוצאה חדשה">
      <div className="cap-amount">
        <span className="cap-amount-cur">₪</span>
        <span className={`cap-amount-val${amount ? '' : ' ph'}`}>{amount || '0'}</span>
      </div>

      <input
        className="cap-desc"
        value={desc}
        onChange={e => setDesc(e.target.value)}
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
        <span className="cap-chip date">היום</span>
      </div>

      <div className="numpad">
        {KEYS.map(k => (
          <button key={k} className={`numkey${k === 'back' ? ' fn' : ''}`} onClick={() => press(k)}>
            {k === 'back' ? <Backspace size={22} /> : k}
          </button>
        ))}
      </div>

      <button className={`cap-save${state === 'done' ? ' ok' : ''}`} disabled={!canSave && state === 'idle'} onClick={save}>
        {state === 'saving' ? <CircleNotch className="spin" size={20} weight="bold" />
          : state === 'done' ? <><Check size={20} weight="bold" /> נשמר</>
          : 'שמירת הוצאה'}
      </button>
    </BottomSheet>
  )
}
