import { useEffect } from 'react'
import { HandCoins, X } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { LoanForm } from './LoanForm'
import { FinishEarly } from './FinishEarly'
import { emptyLoan, formatCurrency } from './types'
import { useOnboarding } from './context'

export function LoansStep() {
  const {
    advance, keyDeliveryDate,
    loans, loanDraftRate, loanTypeLabel,
    editingLoanIdx, setEditingLoanIdx, setLoanForm, showLoanForm, setShowLoanForm,
    addLoan, saveLoanEdit, saveLoanAndOpenNew, removeLoan,
    loansMonthlyPrincipal, loansBalloonTotal,
    loanDocRef, loanAiBusy, loanAiErr, loanAiDone, aiFillLoans,
    fillTestLoans,
  } = useOnboarding()

  // A loan read in the documents step may have been auto-flagged for completion
  // (editingLoanIdx set), but the mortgage step resets the shared working form on its
  // way here — which would open the card showing empty placeholder fields. On entering
  // this step, re-sync the form to the row marked for editing so it opens with the
  // loan's real values; if nothing is flagged, open the first loan still missing
  // rate/term so an incomplete loan never hides behind a tidy "done"-looking card.
  useEffect(() => {
    if (editingLoanIdx !== null) {
      if (loans[editingLoanIdx]) setLoanForm({ ...loans[editingLoanIdx] })
      return
    }
    if (showLoanForm) return
    const idx = loans.findIndex(l => l.repayment_type === 'monthly_fixed' && (loanDraftRate(l) <= 0 || !l.term_months))
    if (idx >= 0) {
      setEditingLoanIdx(idx)
      setLoanForm({ ...loans[idx] })
    }
    // Run once on entering the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <form onSubmit={e => { e.preventDefault(); advance('investment') }}>
      <StepHeader current="loans" icon={<HandCoins size={44} color="var(--accent)" />} title="הלוואות" />
      <FillExampleTop onFill={fillTestLoans} />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

      <div className="onboarding-ai-fill">
        <button type="button" className={`btn-onboard-ai${loanAiDone && !loanAiBusy ? ' is-done' : ''}`} disabled={loanAiBusy}
          onClick={() => loanDocRef.current?.click()}>
          {loanAiBusy
            ? 'קורא את המסמך…'
            : loanAiDone
              ? '✓ ההלוואה נקראה — בדקו למטה · לחצו להעלאה מחדש'
              : '📄 העלו מסמך הלוואה או צילום מסך — מילוי אוטומטי'}
        </button>
        <input ref={loanDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) aiFillLoans(fs); e.target.value = '' }} />
        {loanAiErr && <p className="onboarding-error" role="alert">{loanAiErr}</p>}
        <p className="onboarding-subtitle onboarding-optional" style={{ marginTop: 6 }}>אפשר כמה צילומי מסך יחד · או הזינו ידנית למטה</p>
      </div>

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
                    {isMonthly && (rate <= 0 || !d.term_months) && (
                      <div className="onboarding-track-missing">חסרים פרטים — לחצו להשלמה</div>
                    )}
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

      <button type="submit" className="btn-onboard-primary onboarding-cta-full">הבא</button>
      <FinishEarly />
    </form>
  )
}
