import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HandCoins, X, CaretDown } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { LoanForm } from './LoanForm'
import { FinishEarly } from './FinishEarly'
import { DocFileList } from './DocFileList'
import { emptyLoan, formatCurrency } from './types'
import { useOnboarding } from './context'

export function LoansStep() {
  const {
    advance, keyDeliveryDate,
    loans, setLoans, loanDraftRate, loanTypeLabel,
    editingLoanIdx, setEditingLoanIdx, setLoanForm, setLoanGraceOn, loanForm, showLoanForm, setShowLoanForm,
    addLoan, saveLoanEdit, saveLoanAndOpenNew, removeLoan,
    loansMonthlyPrincipal, loansBalloonTotal,
    loanDocRef, loanAiBusy, loanAiErr, loanAiDone, aiFillLoans,
    loanDocFiles, removeDocFile, renameDocFile,
    fillTestLoans,
  } = useOnboarding()

  const [continuePrompt, setContinuePrompt] = useState(false)
  // Toggles the uploaded-files panel — files show only when the button is tapped.
  const [showDocs, setShowDocs] = useState(false)
  // Bumped on every blocked collapse/save attempt to re-flash the "missing" line.
  const [alertPulse, setAlertPulse] = useState(0)
  // True after a blocked save on the open loan — shows the orange note by its button.
  const [saveAttempted, setSaveAttempted] = useState(false)

  // The only required loan details are amount + (for a monthly loan) rate + term.
  // Lender/description are optional (a placeholder default counts) and never block.
  const loanMissing = (d: (typeof loans)[number]) => {
    const m: string[] = []
    if ((parseFloat(d.principal) || 0) <= 0) m.push('סכום')
    if (d.repayment_type === 'monthly_fixed') {
      if (loanDraftRate(d) <= 0) m.push('ריבית')
      if (!d.term_months) m.push('תקופה')
    }
    return m
  }
  const loanReady = (d: (typeof loans)[number]) => loanMissing(d).length === 0

  // The open row's live truth is the working form, not its last-saved snapshot.
  const effectiveLoans = loans.map((l, i) => (i === editingLoanIdx ? loanForm : l))
  const incompleteLoans = effectiveLoans.filter(l => !loanReady(l))

  // A brand-new loan typed into the inline form but not yet saved — not in `loans`,
  // so without this it would be silently dropped on "המשך" (mirrors the mortgage step).
  const loanHasData = (d: typeof loanForm) => (parseFloat(d.principal) || 0) > 0 || !!(d.lender && d.lender.trim())
  const pendingNewLoan = showLoanForm && editingLoanIdx === null && loanHasData(loanForm)
  const pendingNewLoanReady = pendingNewLoan && loanReady(loanForm)
  const unsavedLoans = pendingNewLoan && !loanReady(loanForm) ? [...incompleteLoans, loanForm] : incompleteLoans

  // Finalize the open loan: save + collapse when ready, otherwise flash what's missing
  // (both in the header line and as an orange note next to the save button).
  const finalizeLoan = (i: number) => {
    if (loanReady(loanForm)) { saveLoanEdit(i); setSaveAttempted(false) }
    else { setSaveAttempted(true); setAlertPulse(p => p + 1) }
  }

  // On entering this step a loan is always opened for review (from the documents-step
  // flag if set, otherwise the first one) — a fresh upload never lands collapsed.
  useEffect(() => {
    if (editingLoanIdx !== null) {
      if (loans[editingLoanIdx]) {
        setLoanForm({ ...loans[editingLoanIdx] })
        setLoanGraceOn((parseInt(loans[editingLoanIdx].grace_months) || 0) > 0)
      }
      return
    }
    if (showLoanForm) return
    if (loans.length > 0) {
      setEditingLoanIdx(0)
      setLoanForm({ ...loans[0] })
      setLoanGraceOn((parseInt(loans[0].grace_months) || 0) > 0)
    }
    // Run once on entering the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc closes the "missing details" confirm dialog (mirrors the app Modal — UX-05).
  useEffect(() => {
    if (!continuePrompt) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContinuePrompt(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [continuePrompt])

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (pendingNewLoanReady) addLoan()   // auto-save a fully-filled new loan instead of dropping it
      // Block advancing past a loan still missing a required field — ask first.
      if (unsavedLoans.length > 0) { setContinuePrompt(true); return }
      if (editingLoanIdx !== null && loanReady(loanForm)) saveLoanEdit(editingLoanIdx)
      advance('investment')
    }} noValidate>
      <StepHeader current="loans" icon={<HandCoins size={44} color="var(--accent)" />} title="הלוואות" />
      <FillExampleTop onFill={fillTestLoans} />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

      <div className="onboarding-ai-fill">
        <button type="button" className={`btn-onboard-ai${loanAiDone && !loanAiBusy ? ' is-done' : ''}`} disabled={loanAiBusy}
          onClick={() => { if (loanAiBusy) return; loanDocFiles.length ? setShowDocs(o => !o) : loanDocRef.current?.click() }}
          aria-expanded={loanDocFiles.length ? showDocs : undefined}>
          {loanAiBusy
            ? 'קורא את המסמך…'
            : loanDocFiles.length
              ? <>📎 {loanDocFiles.length} {loanDocFiles.length === 1 ? 'קובץ הועלה' : 'קבצים הועלו'} — הקישו לצפייה <CaretDown size={15} weight="bold" className={`onboarding-ai-caret${showDocs ? ' is-open' : ''}`} /></>
              : '📄 העלו מסמך הלוואה או צילום מסך — מילוי אוטומטי'}
        </button>
        <input ref={loanDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) aiFillLoans(fs); e.target.value = '' }} />
        {showDocs && <DocFileList files={loanDocFiles} onFiles={aiFillLoans} onRemove={i => removeDocFile('loan', i)} onRename={(i, name) => renameDocFile('loan', i, name)} />}
        {loanAiErr && <p className="onboarding-error" role="alert">{loanAiErr}</p>}
        <p className="onboarding-subtitle onboarding-optional" style={{ marginTop: 6 }}>אפשר כמה צילומי מסך יחד · או הזינו ידנית למטה</p>
      </div>

      {/* Saved loans list — tap the header to open; tap again to save + collapse */}
      {loans.length > 0 && (
        <div className="onboarding-list">
          {loans.map((d, i) => {
            const isMonthly = d.repayment_type === 'monthly_fixed'
            const rate = loanDraftRate(d)
            const isEditing = editingLoanIdx === i
            // While open, reflect the live form so "missing" updates as the user types.
            const view = isEditing ? loanForm : d
            const missing = loanMissing(view)
            return (
              <div key={i} className="onboarding-list-row onboarding-list-row--expandable">
                <div className="onboarding-list-row-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (isEditing) finalizeLoan(i)            // tap top = save + collapse (alert if incomplete)
                    else { setEditingLoanIdx(i); setLoanForm({ ...d }); setLoanGraceOn((parseInt(d.grace_months) || 0) > 0); setShowLoanForm(false); setSaveAttempted(false) }
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
                    {missing.length > 0 && (
                      <div className="onboarding-track-missing onboarding-track-missing--flash"
                        key={isEditing ? `m-${i}-${alertPulse}` : `m-${i}`}>
                        חסר {missing.join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="onboarding-list-row-actions">
                    <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); removeLoan(i) }} aria-label="מחיקה" title="מחיקה"><X size={16} /></button>
                  </div>
                </div>
                {isEditing && <LoanForm
                  onSave={() => finalizeLoan(i)}
                  onCancel={() => { setEditingLoanIdx(null); setSaveAttempted(false) }}
                  alert={saveAttempted ? loanMissing(loanForm) : null} />}
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

      <button type="submit" className="btn-onboard-primary onboarding-cta-full">המשך</button>
      <FinishEarly />

      {continuePrompt && createPortal(
        <div className="onboarding-dialog-overlay" onClick={() => setContinuePrompt(false)}>
          <div className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-dialog-title" onClick={e => e.stopPropagation()}>
            <div className="onboarding-dialog-title" id="onboarding-dialog-title">חסרים פרטים בהלוואה</div>
            <p className="onboarding-dialog-lead">אם תמשיכו, ההלוואה הזו לא תישמר:</p>
            <ul className="onboarding-dialog-list">
              {unsavedLoans.map((l, idx) => (
                <li key={idx}>
                  <strong>{l.label.trim() || loanTypeLabel(l.repayment_type)}</strong> — חסר {loanMissing(l).join(', ')}
                </li>
              ))}
            </ul>
            <div className="onboarding-dialog-actions">
              <button type="button" className="btn-onboard-primary onboarding-cta-full" onClick={() => {
                const idx = loans.findIndex(l => !loanReady(l))
                setContinuePrompt(false)
                if (idx >= 0) { setEditingLoanIdx(idx); setLoanForm({ ...loans[idx] }); setShowLoanForm(false) }
              }}>חזרה להשלמה</button>
              <button type="button" className="btn-onboard-skip onboarding-cta-full" onClick={() => {
                setLoans(prev => prev.filter(loanReady))
                setShowLoanForm(false)   // discard the unsaved new-loan form too
                setEditingLoanIdx(null)
                setContinuePrompt(false)
                advance('investment')
              }}>המשך בלי לשמור</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </form>
  )
}
