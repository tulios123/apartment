import { Bank, ArrowLeft, ArrowRight, X } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { TrackForm } from './TrackForm'
import { FinishEarly } from './FinishEarly'
import { emptyTrack, emptyLoan, formatCurrency } from './types'
import { useOnboarding } from './context'

export function MortgageStep() {
  const {
    advance, back, keyDeliveryDate, setLoanForm,
    mortgageAiBusy, mortgageDocRef, mortgageAiErr, aiFillMortgage,
    tracks, trackMonthlyPayment, trackEffectiveRate, trackTypeLabel,
    editingIdx, setEditingIdx, setTrackForm, setGraceOn, showTrackForm, setShowTrackForm,
    addTrack, saveTrackEdit, saveCurrentAndOpenNew, removeTrack,
    totalPrincipal, totalMonthly, hasAnyGrace, totalGraceMonthly,
    showFillExample, fillTestMortgage,
  } = useOnboarding()

  return (
    <form onSubmit={e => {
      e.preventDefault()
      setLoanForm(emptyLoan(keyDeliveryDate || undefined))
      advance('loans')
    }}>
      <StepHeader current="mortgage" icon={<Bank size={44} color="var(--accent)" />} title="משכנתא" />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

      <div className="onboarding-ai-fill">
        <button type="button" className="btn-onboard-ai" disabled={mortgageAiBusy}
          onClick={() => mortgageDocRef.current?.click()}>
          {mortgageAiBusy ? 'קורא את המסמך…' : '📄 העלו אישור מהבנק — מילוי אוטומטי'}
        </button>
        <input ref={mortgageDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) aiFillMortgage(f); e.target.value = '' }} />
        {mortgageAiErr && <p className="onboarding-error" role="alert">{mortgageAiErr}</p>}
        <p className="onboarding-subtitle onboarding-optional" style={{ marginTop: 6 }}>או הזינו את המסלולים ידנית למטה</p>
      </div>

      {/* Saved tracks list — click header to toggle edit in-place */}
      {tracks.length > 0 && (
        <div className="onboarding-list">
          {tracks.map((d, i) => {
            const monthly = trackMonthlyPayment(d)
            const graceMonthly = (parseInt(d.grace_months) || 0) > 0
              ? (parseFloat(d.principal) || 0) * (trackEffectiveRate(d) / 100 / 12)
              : 0
            const isEditing = editingIdx === i
            return (
              <div key={i} className="onboarding-list-row onboarding-list-row--expandable">
                <div className="onboarding-list-row-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (isEditing) {
                      setEditingIdx(null)
                    } else {
                      setEditingIdx(i)
                      setTrackForm({ ...d })
                      setGraceOn((parseInt(d.grace_months) || 0) > 0)
                      setShowTrackForm(false)
                    }
                  }}>
                  <div className="onboarding-track-summary">
                    <div className="onboarding-track-summary-top">
                      <span className="onboarding-list-row-type">{trackTypeLabel(d.track_type)}</span>
                      <span className="onboarding-track-payment">
                        {graceMonthly > 0
                          ? <>{formatCurrency(graceMonthly)} <span className="text-muted">/ {formatCurrency(monthly)}</span></>
                          : formatCurrency(monthly)
                        }
                        <span className="text-muted"> / חודש</span>
                      </span>
                    </div>
                    <div className="onboarding-track-summary-sub">
                      <span>קרן {formatCurrency(parseFloat(d.principal) || 0)}</span>
                      <span>·</span>
                      <span>{trackEffectiveRate(d).toFixed(2)}%</span>
                      <span>·</span>
                      <span>{d.term_months} ח׳</span>
                      {(parseInt(d.grace_months) || 0) > 0 && <><span>·</span><span>גרייס {d.grace_months} ח׳</span></>}
                    </div>
                  </div>
                  <div className="onboarding-list-row-actions">
                    <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); removeTrack(i) }} aria-label="מחיקה" title="מחיקה"><X size={16} /></button>
                  </div>
                </div>
                {isEditing && <TrackForm onSave={() => saveTrackEdit(i)} onCancel={() => setEditingIdx(null)} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Inline track form for new track */}
      {showTrackForm && <TrackForm onSave={addTrack} onCancel={() => setShowTrackForm(false)} />}

      {/* Add track button — always shown */}
      <button type="button" className="btn-onboard-skip onboarding-add-btn"
        style={{ marginBottom: 16 }}
        onClick={() => {
          if (showTrackForm || editingIdx !== null) {
            saveCurrentAndOpenNew()
          } else {
            setTrackForm(emptyTrack(keyDeliveryDate || undefined))
            setGraceOn(false)
            setShowTrackForm(true)
            setEditingIdx(null)
          }
        }}>
        + הוסף מסלול
      </button>

      {/* Conclusion totals */}
      {tracks.length > 0 && (
        <div className="onboarding-mortgage-summary">
          <div className="onboarding-list-total">
            <span>סה״כ קרן</span>
            <strong>{formatCurrency(totalPrincipal)}</strong>
          </div>
          {hasAnyGrace && totalGraceMonthly > 0 && (
            <div className="onboarding-list-total">
              <span>תשלום חודשי בגרייס</span>
              <strong>{formatCurrency(totalGraceMonthly)}</strong>
            </div>
          )}
          {totalMonthly > 0 && (
            <div className="onboarding-list-total">
              <span>{hasAnyGrace ? 'תשלום חודשי לאחר גרייס' : 'תשלום חודשי'}</span>
              <strong>{formatCurrency(totalMonthly)}</strong>
            </div>
          )}
        </div>
      )}

      <div className="onboarding-actions">
        <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
        {showFillExample && (
          <button type="button" className="btn-onboard-skip" onClick={fillTestMortgage}>מלא דוגמה</button>
        )}
        <button type="submit" className="btn-onboard-primary">{tracks.length ? 'הבא' : 'דלג'} <ArrowLeft size={16} /></button>
      </div>
      <FinishEarly />
    </form>
  )
}
