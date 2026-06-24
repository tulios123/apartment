import { ShieldCheck, ArrowRight, Check, X } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { PolicyForm } from './PolicyForm'
import { emptyPolicy, formatCurrency } from './types'
import { useOnboarding } from './context'

export function InsuranceStep() {
  const {
    back, requestFinish, saving, pendingFinish, error,
    policies, editingPolicyIdx, setEditingPolicyIdx, setPolicyForm,
    showPolicyForm, setShowPolicyForm,
    addPolicy, savePolicyEdit, savePolicyAndOpenNew, removePolicy,
    showFillExample, fillTestInsurance,
  } = useOnboarding()

  return (
    <form onSubmit={e => { e.preventDefault(); requestFinish() }}>
      <StepHeader current="insurance" icon={<ShieldCheck size={44} color="var(--accent)" />} title="ביטוחים" />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

      {/* Saved policies list — click header to toggle edit in-place */}
      {policies.length > 0 && (
        <div className="onboarding-list">
          {policies.map((p, i) => {
            const premium = parseFloat(p.monthly_premium) || 0
            const isEditing = editingPolicyIdx === i
            return (
              <div key={i} className="onboarding-list-row onboarding-list-row--expandable">
                <div className="onboarding-list-row-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (isEditing) {
                      setEditingPolicyIdx(null)
                    } else {
                      setEditingPolicyIdx(i)
                      setPolicyForm({ ...p })
                      setShowPolicyForm(false)
                    }
                  }}>
                  <div className="onboarding-track-summary">
                    <div className="onboarding-track-summary-top">
                      <span className="onboarding-list-row-type">{p.type}</span>
                      <span className="onboarding-track-payment">
                        {premium > 0 ? formatCurrency(premium) : <span className="text-muted">—</span>}
                        <span className="text-muted"> / חודש</span>
                      </span>
                    </div>
                    {(p.company || p.start_date) && (
                      <div className="onboarding-track-summary-sub">
                        {p.company && <span>{p.company}</span>}
                        {p.company && p.start_date && <span>·</span>}
                        {p.start_date && <span>מ-{p.start_date}</span>}
                      </div>
                    )}
                  </div>
                  <div className="onboarding-list-row-actions">
                    <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); removePolicy(i) }} aria-label="מחיקה" title="מחיקה"><X size={16} /></button>
                  </div>
                </div>
                {isEditing && <PolicyForm onSave={() => savePolicyEdit(i)} onCancel={() => setEditingPolicyIdx(null)} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Inline new-policy form */}
      {showPolicyForm && <PolicyForm onSave={addPolicy} onCancel={() => setShowPolicyForm(false)} />}

      {/* Add policy button — always shown */}
      <button type="button" className="btn-onboard-skip onboarding-add-btn"
        style={{ marginBottom: 16 }}
        onClick={() => {
          if (showPolicyForm || editingPolicyIdx !== null) {
            savePolicyAndOpenNew()
          } else {
            setPolicyForm(emptyPolicy())
            setShowPolicyForm(true)
            setEditingPolicyIdx(null)
          }
        }}>
        + הוסף פוליסה
      </button>

      {/* Monthly total */}
      {policies.length > 0 && (
        <div className="onboarding-mortgage-summary">
          <div className="onboarding-list-total">
            <span>סה״כ פרמיה חודשית</span>
            <strong>{formatCurrency(policies.reduce((s, p) => s + (parseFloat(p.monthly_premium) || 0), 0))}</strong>
          </div>
        </div>
      )}

      {error && <p className="onboarding-error" role="alert">{error}</p>}
      <div className="onboarding-actions">
        <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
        {showFillExample && (
          <button type="button" className="btn-onboard-skip" onClick={fillTestInsurance}>מלא דוגמה</button>
        )}
        <button type="submit" className="btn-onboard-primary" disabled={saving || pendingFinish}>
          {saving ? 'שומר...' : pendingFinish ? 'רגע, קוראים…' : <><span>סיום</span><Check size={14} weight="bold" /></> }
        </button>
      </div>
    </form>
  )
}
