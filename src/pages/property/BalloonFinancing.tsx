import { useState } from 'react'
import { PencilSimple, X } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { upsertLoan, deleteLoan } from '../../hooks/useLoansData'
import { formatCurrency, formatNum } from '../../lib/format'
import type { Loan } from '../../types'

interface BalloonFinancingProps {
  balloonLoans: Loan[]
  balloonTotal: number
  onChanged: () => Promise<void>
}

const TODAY = new Date().toISOString().slice(0, 10)

interface BalloonForm {
  id?: string
  label: string
  lender: string
  principal: string
  notes: string
}

function emptyForm(): BalloonForm {
  return { label: '', lender: '', principal: '', notes: '' }
}

function formFromLoan(l: Loan): BalloonForm {
  return {
    id: l.id,
    label: l.label ?? '',
    lender: l.lender ?? '',
    principal: String(Math.round(l.principal)),
    notes: l.notes ?? '',
  }
}

/**
 * Balloon (interest-free, repaid on sale) financing — surfaced in the investment
 * view as a source of funds that offsets net equity. No monthly repayment.
 */
export default function BalloonFinancing({ balloonLoans, balloonTotal, onChanged }: BalloonFinancingProps) {
  const { user } = useAuth()

  const [form, setForm] = useState<BalloonForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function setField<K extends keyof BalloonForm>(key: K, val: BalloonForm[K]) {
    setForm(f => f ? { ...f, [key]: val } : f)
  }

  async function handleSave() {
    if (!form || !user) return
    const principal = parseFloat(form.principal) || 0
    if (principal <= 0) { setSaveErr('יש להזין סכום'); return }
    setSaving(true)
    setSaveErr(null)
    try {
      await upsertLoan({
        id: form.id,
        owner_id: user.id,
        label: form.label.trim() || null,
        lender: form.lender.trim() || null,
        repayment_type: 'balloon',
        principal,
        annual_rate: null,
        term_months: null,
        start_date: form.id ? undefined : TODAY,
        notes: form.notes.trim() || null,
      })
      await onChanged()
      setForm(null)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLoan(id)
      setConfirmDeleteId(null)
      await onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה')
    }
  }

  if (balloonLoans.length === 0 && !form) {
    return (
      <div className="balloon-financing">
        <button className="btn-secondary balloon-add-btn" onClick={() => { setForm(emptyForm()); setSaveErr(null) }}>
          + הוסף מימון בלון
        </button>
        <p className="prop-section-hint balloon-hint">
          הלוואת בלון ללא ריבית, נפרעת במכירה. מקטינה את ההון העצמי נטו ומתקזזת מתמורת המכירה.
        </p>
      </div>
    )
  }

  return (
    <div className="balloon-financing">
      <div className="prop-card">
        {balloonLoans.map(loan => {
          const isPendingDelete = confirmDeleteId === loan.id
          return (
            <div key={loan.id} className="balloon-row">
              <div className="balloon-row-info">
                <span className="balloon-row-name">{loan.label || 'מימון בלון'}</span>
                {loan.lender && <span className="balloon-row-lender">{loan.lender}</span>}
              </div>
              <span className="balloon-row-amount">{formatCurrency(loan.principal)}</span>
              {isPendingDelete ? (
                <span className="mortgage-delete-confirm">
                  <button className="btn-xs btn-danger-solid" onClick={() => handleDelete(loan.id)}>מחק</button>
                  <button className="btn-xs btn-secondary" onClick={() => setConfirmDeleteId(null)}>ביטול</button>
                </span>
              ) : (
                <span className="balloon-row-actions">
                  <button className="btn-icon" onClick={() => { setForm(formFromLoan(loan)); setSaveErr(null) }} title="ערוך" aria-label="ערוך">
                    <PencilSimple size={15} />
                  </button>
                  <button className="btn-icon danger" onClick={() => setConfirmDeleteId(loan.id)} title="מחק" aria-label="מחק">
                    <X size={13} />
                  </button>
                </span>
              )}
            </div>
          )
        })}
        {balloonLoans.length > 0 && (
          <div className="inv-cost-total">
            <span>סה״כ מימון בלון</span>
            <span className="inv-cost-total-amount">{formatCurrency(balloonTotal)}</span>
          </div>
        )}
      </div>

      {form && (
        <div className="prop-card balloon-form-card">
          <h3>{form.id ? 'עריכת מימון בלון' : 'מימון בלון חדש'}</h3>
          <div className="form-2col">
            <div className="form-row">
              <label>תיאור</label>
              <input type="text" className="form-input" value={form.label}
                onChange={e => setField('label', e.target.value)} placeholder="למשל: הלוואת בלון" />
            </div>
            <div className="form-row">
              <label>נותן ההלוואה</label>
              <input type="text" className="form-input" value={form.lender}
                onChange={e => setField('lender', e.target.value)} placeholder="למשל: הורים" />
            </div>
          </div>
          <div className="form-row">
            <label>סכום (₪)</label>
            <input type="text" inputMode="numeric" className="form-input" value={formatNum(form.principal)}
              onChange={e => setField('principal', e.target.value.replace(/[^\d]/g, ''))} placeholder="200,000" />
          </div>
          <div className="form-row">
            <label>הערות (אופציונלי)</label>
            <input type="text" className="form-input" value={form.notes}
              onChange={e => setField('notes', e.target.value)} />
          </div>
          {saveErr && <div className="form-error" role="alert">{saveErr}</div>}
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => { setForm(null); setSaveErr(null) }} disabled={saving}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      )}

      {!form && (
        <button className="btn-secondary balloon-add-btn" onClick={() => { setForm(emptyForm()); setSaveErr(null) }}>
          + הוסף מימון בלון
        </button>
      )}
    </div>
  )
}
