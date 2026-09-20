import { useMemo, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { formatCurrency, formatNum, sanitizeAmountInt } from '../../lib/format'
import { purchaseTax } from '../../lib/purchaseTax'
import { buildPlan, type PurchasePlan } from '../../lib/purchasePlan'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { INVESTMENT_COST_CATEGORIES } from '../../lib/constants'

const fmt = (v: number) => formatCurrency(v)

/**
 * Building the payment plan — a short conversation, not a blank form.
 *
 * The owner (09.09): "אני חושב שמילוי אינטרקטיבי, מה תנאי התשלום: 10 ואז 15 נניח או אחר
 * או 15 ואז 10 … ולבחור תאריכים." He knows his deal in percentages; the shekels are ours to
 * work out. That division is the point — recomputing them by hand is one of the three pains
 * this stage exists to remove.
 */
const SPLITS: [number, number][] = [[10, 15], [15, 10], [10, 10], [20, 0]]

export function PlanSetup({ price, signing, handover, onDone, onClose }: {
  price: number
  signing: string
  handover: string
  onDone: (plan: PurchasePlan) => void
  onClose: () => void
}) {
  // The costs he already entered come in as they are — his figures, so they are already
  // certain. Equity is excluded: it is the payments themselves, not a cost on top of them.
  const { costs: stored } = useInvestmentData()
  const costs = useMemo(() => stored
    .filter(c => c.category !== 'self_equity' && Number(c.amount) > 0)
    .map(c => ({
      label: INVESTMENT_COST_CATEGORIES.find(x => x.value === c.category)?.label ?? c.label ?? 'עלות',
      amount: Number(c.amount),
    })), [stored])

  const [first, setFirst] = useState(10)
  const [second, setSecond] = useState(15)
  const [custom, setCustom] = useState(false)
  const [single, setSingle] = useState(true)

  const mortgagePct = Math.max(0, 100 - first - second)
  const tax = useMemo(() => purchaseTax(price, single), [price, single])
  const pct = (p: number) => Math.round(price * p / 100)
  const fromPocket = pct(first) + pct(second) + tax + costs.reduce((s, c) => s + c.amount, 0)
  const valid = first > 0 && first + second <= 100

  function choose(a: number, b: number) { setFirst(a); setSecond(b); setCustom(false) }

  return (
    <Modal title="לוח התשלומים" onClose={onClose}>
      <div className="pln-setup">
        <p className="pln-lead">
          מה תנאי התשלום בחוזה שלך? האחוזים ממך — הסכומים מאיתנו.
        </p>

        <div className="pln-price">
          <span>מחיר הדירה</span><b>{fmt(price)}</b>
        </div>

        <div className="pln-field">
          <div className="pln-label">איך מתחלקים התשלומים?</div>
          <div className="pln-splits">
            {SPLITS.map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                type="button"
                className={`pln-split${!custom && first === a && second === b ? ' on' : ''}`}
                onClick={() => choose(a, b)}
              >
                {b > 0 ? `${a}% ואז ${b}%` : `${a}% בלבד`}
              </button>
            ))}
            <button type="button" className={`pln-split${custom ? ' on' : ''}`} onClick={() => setCustom(true)}>
              אחר
            </button>
          </div>
        </div>

        {custom && (
          <div className="pln-row">
            <label className="pln-custom">
              <span>בחתימה %</span>
              <input type="number" min="0" max="100" value={first}
                onChange={e => setFirst(Math.max(0, Math.min(100, Number(sanitizeAmountInt(e.target.value)) || 0)))} />
            </label>
            <label className="pln-custom">
              <span>תשלום שני %</span>
              <input type="number" min="0" max="100" value={second}
                onChange={e => setSecond(Math.max(0, Math.min(100, Number(sanitizeAmountInt(e.target.value)) || 0)))} />
            </label>
          </div>
        )}

        {/* The arithmetic, live. This is the thing he said he keeps doing by hand. */}
        <div className="pln-preview">
          <div className="pln-prow"><span>בחתימה · {first}%</span><b>{fmt(pct(first))}</b></div>
          {second > 0 && <div className="pln-prow"><span>תשלום שני · {second}%</span><b>{fmt(pct(second))}</b></div>}
          <div className="pln-prow muted"><span>משכנתא במסירה · {mortgagePct}%</span><b>{fmt(pct(mortgagePct))}</b></div>
        </div>

        <div className="pln-field">
          <div className="pln-label">מס רכישה</div>
          <div className="pln-seg">
            <button type="button" className={single ? 'on' : ''} onClick={() => setSingle(true)}>דירה יחידה</button>
            <button type="button" className={!single ? 'on' : ''} onClick={() => setSingle(false)}>דירה נוספת</button>
          </div>
          <div className="pln-tax">
            <b>{fmt(tax)}</b>
            <span>{tax === 0 ? 'מתחת למדרגת הפטור' : 'לפי מדרגות 2026'} · לתשלום עד 60 יום מהחתימה</span>
          </div>
        </div>

        <div className="pln-total">
          <span>סה״כ מהכיס</span>
          <b>{formatNum(fromPocket)} ₪</b>
        </div>
        <p className="pln-foot">
          כולל את ההוצאות שכבר רשומות אצלך. הכול ניתן לתיקון אחר כך — עריכה של מספר הופכת אותו לשלך.
        </p>

        <button
          className="btn-primary pln-cta"
          disabled={!valid}
          onClick={() => onDone(buildPlan({
            price, signing, handover,
            firstPct: first, secondPct: second, singleApartment: single, costs,
          }))}
        >
          בניית הלוח
        </button>
      </div>
    </Modal>
  )
}
