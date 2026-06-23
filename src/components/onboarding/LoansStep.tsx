import { HandCoins, ArrowLeft, ArrowRight, X } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { LoanForm } from './LoanForm'
import { emptyLoan, formatCurrency } from './types'
import { useOnboarding } from './context'

export function LoansStep() {
  const {
    advance, back, keyDeliveryDate,
    loans, loanDraftRate, loanTypeLabel,
    editingLoanIdx, setEditingLoanIdx, setLoanForm, showLoanForm, setShowLoanForm,
    addLoan, saveLoanEdit, saveLoanAndOpenNew, removeLoan,
    loansMonthlyPrincipal, loansBalloonTotal,
    showFillExample, fillTestLoans,
  } = useOnboarding()

  return (
    <form onSubmit={e => { e.preventDefault(); advance('investment') }}>
      <StepHeader current="loans" icon={<HandCoins size={44} color="var(--accent)" />} title="הלוואות" />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

      {/* Saved loans list — click header to toggle edit in-place */}
      {loans.length > 0 && (
        <div className="onboarding-list">
          {loans.map((d, i) => {
            const isMonthly = d.repayment_type === 'monthly_fixed'
            const rate = loanDraftRate(d)
            const isEditing = editingLoanIdx === i
            return (
              <div key={i} className="onboarding-list-row onboarding-list-row--expandable">
                <div className="onboarding-list-row-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (isEditing) {
                      setEditingLoanIdx(null)
                    } else {
                      setEditingLoanIdx(i)
                      setLoanForm({ ...d })
                      setShowLoanForm(false)
                    }
                  }}>
                  <div className="onboarding-track-summary">
                    <div className="onboarding-track-summary-top">
                      <span className="onboarding-list-row-type">{d.label.trim() || loanTypeLabel(d.repayment_type)}</span>
                      <span className="onboarding-track-payment">
                        {isMonthly
                          ? <>{rate > 0 ? <>{rate.toFixed(2)}%<span className="text-muted"> ריבית</span></> : <span className="text-muted">—</span>}</>
                          : <span className="text-muted">נפרע במכירה</span>
                        }
                      </span>
                    </div>
                    <div className="onboarding-track-summary-sub">
                      <span>{loanTypeLabel(d.repayment_type)}</span>
                      <span>·</span>
                      <span>קרן {formatCurrency(parseFloat(d.principal) || 0)}</span>
                      {isMonthly && d.term_months && <><span>·</span><span>{d.term_months} ח׳</span></>}
                      {d.lender.trim() && <><span>·</span><span>{d.lender.trim()}</span></>}
                    </div>
                  </div>
                  <div className="onboarding-list-row-actions">
                    <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); removeLoan(i) }} aria-label="מחיקה" title="מחיקה"><X size={16} /></button>
                  </div>
                </div>
                {isEditing && <LoanForm onSave={() => saveLoanEdit(i)} onCancel={() => setEditingLoanIdx(null)} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Inline form for new loan */}
      {showLoanForm && <LoanForm onSave={addLoan} onCancel={() => setShowLoanForm(false)} />}

      {/* Add loan button — always shown */}
      <button type="button" className="btn-onboard-skip onboarding-add-btn"
        style={{ marginBottom: 16 }}
        onClick={() => {
          if (showLoanForm || editingLoanIdx !== null) {
            saveLoanAndOpenNew()
          } else {
            setLoanForm(emptyLoan(keyDeliveryDate || undefined))
            setShowLoanForm(true)
            setEditingLoanIdx(null)
          }
        }}>
        + הוסף הלוואה
      </button>

      {/* Conclusion totals */}
      {loans.length > 0 && (loansMonthlyPrincipal > 0 || loansBalloonTotal > 0) && (
        <div className="onboarding-mortgage-summary">
          {loansMonthlyPrincipal > 0 && (
            <div className="onboarding-list-total">
              <span>סך הלוואות (קרן)</span>
              <strong>{formatCurrency(loansMonthlyPrincipal)}</strong>
            </div>
          )}
          {loansBalloonTotal > 0 && (
            <div className="onboarding-list-total">
              <span>מימון בלון (נפרע במכירה)</span>
              <strong>{formatCurrency(loansBalloonTotal)}</strong>
            </div>
          )}
        </div>
      )}

      <div className="onboarding-actions">
        <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
        {showFillExample && (
          <button type="button" className="btn-onboard-skip" onClick={fillTestLoans}>מלא דוגמה</button>
        )}
        <button type="submit" className="btn-onboard-primary">{loans.length ? 'הבא' : 'דלג'} <ArrowLeft size={16} /></button>
      </div>
    </form>
  )
}
