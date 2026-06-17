import { useState } from 'react'
import { PencilSimple, X } from '@phosphor-icons/react'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
import { useAuth } from '../../contexts/AuthContext'
import { useLoansData, upsertLoan, deleteLoan } from '../../hooks/useLoansData'
import { loanBalance, monthsRemaining, loanEndDate } from '../../lib/loans'
import { formatCurrency, formatDate, formatNum } from '../../lib/format'
import { SkeletonList } from '../../components/ui/Skeleton'
import { PageError } from '../../components/ui/EmptyState'
import type { Loan } from '../../types'

const TODAY = new Date().toISOString().slice(0, 10)

interface LoanForm {
  id?: string
  label: string
  lender: string
  principal: string    // raw digits
  annual_rate: string  // percent
  term_months: string
  start_date: string
  notes: string
}

function emptyForm(): LoanForm {
  return { label: '', lender: '', principal: '', annual_rate: '', term_months: '', start_date: TODAY, notes: '' }
}

function formFromLoan(l: Loan): LoanForm {
  return {
    id: l.id,
    label: l.label ?? '',
    lender: l.lender ?? '',
    principal: String(Math.round(l.principal)),
    annual_rate: l.annual_rate != null ? l.annual_rate.toFixed(3) : '',
    term_months: l.term_months != null ? String(l.term_months) : '',
    start_date: l.start_date ?? TODAY,
    notes: l.notes ?? '',
  }
}

export default function Loans() {
  const { user } = useAuth()
  const { monthlyLoans, summary, loading, error, refetch } = useLoansData()

  const [form, setForm] = useState<LoanForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function setField<K extends keyof LoanForm>(key: K, val: LoanForm[K]) {
    setForm(f => f ? { ...f, [key]: val } : f)
  }

  async function handleSave() {
    if (!form || !user) return
    const principal = parseFloat(form.principal) || 0
    if (principal <= 0) { setSaveErr('יש להזין סכום הלוואה'); return }
    setSaving(true)
    setSaveErr(null)
    try {
      await upsertLoan({
        id: form.id,
        owner_id: user.id,
        label: form.label.trim() || null,
        lender: form.lender.trim() || null,
        repayment_type: 'monthly_fixed',
        principal,
        annual_rate: parseFloat(form.annual_rate) || 0,
        term_months: parseInt(form.term_months) || null,
        start_date: form.start_date || null,
        notes: form.notes.trim() || null,
      })
      await refetch()
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
      await refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה')
    }
  }

  if (loading) return <SkeletonList rows={3} />
  if (error) return <PageError message={error} onRetry={refetch} />

  if (monthlyLoans.length === 0 && !form) {
    return (
      <div className="empty-state-cta">
        <div className="empty-state-cta-icon"><ClayIllustration variant="bank" /></div>
        <p>עדיין לא הוספת הלוואה</p>
        <button className="btn-primary" onClick={() => setForm(emptyForm())}>+ הוסף הלוואה</button>
      </div>
    )
  }

  return (
    <section className="loans-section">
      {/* Summary */}
      {monthlyLoans.length > 0 && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-label">יתרת הלוואות</div>
            <div className="summary-amount">{formatCurrency(summary.monthlyBalance)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">ריבית ששולמה עד היום</div>
            <div className="summary-amount">{formatCurrency(summary.interestPaidToDate)}</div>
          </div>
        </div>
      )}

      {/* Loan cards */}
      {monthlyLoans.map(loan => {
        const balance = loanBalance(loan)
        const remaining = monthsRemaining(loan)
        const end = loanEndDate(loan)
        const isPendingDelete = confirmDeleteId === loan.id
        return (
          <div key={loan.id} className="prop-card loan-card">
            <div className="loan-card-head">
              <div className="loan-card-title">
                <span className="loan-card-name">{loan.label || 'הלוואה'}</span>
                {loan.lender && <span className="loan-card-lender">{loan.lender}</span>}
              </div>
              <div className="loan-card-actions">
                {isPendingDelete ? (
                  <span className="mortgage-delete-confirm">
                    <span className="mortgage-delete-confirm-label">למחוק?</span>
                    <button className="btn-xs btn-danger-solid" onClick={() => handleDelete(loan.id)}>מחק</button>
                    <button className="btn-xs btn-secondary" onClick={() => setConfirmDeleteId(null)}>ביטול</button>
                  </span>
                ) : (
                  <>
                    <button className="btn-icon" onClick={() => { setForm(formFromLoan(loan)); setSaveErr(null) }} title="ערוך" aria-label="ערוך הלוואה">
                      <PencilSimple size={16} />
                    </button>
                    <button className="btn-icon danger" onClick={() => setConfirmDeleteId(loan.id)} title="מחק" aria-label="מחק הלוואה">
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="loan-card-numbers">
              <span>קרן: <strong>{formatCurrency(loan.principal)}</strong></span>
              <span>ריבית: <strong>{(loan.annual_rate ?? 0).toFixed(2)}%</strong></span>
              <span>יתרה: <strong>{formatCurrency(balance)}</strong></span>
              {loan.term_months ? <span>נותרו: <strong>{remaining} חודשים</strong></span> : null}
            </div>
            <div className="loan-card-meta">
              {loan.start_date && <span>מתאריך {formatDate(loan.start_date)}</span>}
              {end && <span>· סיום משוער {formatDate(end)}</span>}
            </div>
          </div>
        )
      })}

      {/* Add button */}
      {!form && (
        <button className="btn-secondary loans-add-btn" onClick={() => { setForm(emptyForm()); setSaveErr(null) }}>
          + הוסף הלוואה
        </button>
      )}

      {/* Add / edit form */}
      {form && (
        <div className="prop-card loan-form-card">
          <h3>{form.id ? 'עריכת הלוואה' : 'הלוואה חדשה'}</h3>

          <div className="form-2col">
            <div className="form-row">
              <label>תיאור</label>
              <input type="text" className="form-input" value={form.label}
                onChange={e => setField('label', e.target.value)} placeholder="למשל: הלוואה משלימה" />
            </div>
            <div className="form-row">
              <label>נותן ההלוואה</label>
              <input type="text" className="form-input" value={form.lender}
                onChange={e => setField('lender', e.target.value)} placeholder="למשל: בנק הפועלים" />
            </div>
          </div>

          <div className="form-row">
            <label>סכום ההלוואה (₪)</label>
            <input type="text" inputMode="numeric" className="form-input" value={formatNum(form.principal)}
              onChange={e => setField('principal', e.target.value.replace(/[^\d]/g, ''))} placeholder="100,000" />
          </div>

          <div className="form-2col">
            <div className="form-row">
              <label>ריבית שנתית (%)</label>
              <input type="number" className="form-input" value={form.annual_rate}
                onChange={e => setField('annual_rate', e.target.value)} placeholder="5.000" step="0.001" min="0" />
            </div>
            <div className="form-row">
              <label>תקופה (חודשים)</label>
              <input type="number" className="form-input" value={form.term_months}
                onChange={e => setField('term_months', e.target.value)} placeholder="60" min="1" max="600" />
              {parseInt(form.term_months) > 0 && (
                <span className="form-hint">= {(parseInt(form.term_months) / 12).toFixed(1)} שנים</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <label>תאריך התחלה</label>
            <input type="date" className="form-input" value={form.start_date}
              onChange={e => setField('start_date', e.target.value)} />
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
              {saving ? 'שומר...' : 'שמור הלוואה'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
