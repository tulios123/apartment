import { Check } from '@phosphor-icons/react'
import { INS_TYPES, formatNum } from './types'
import { useOnboarding } from './context'

// Inline editor for a single insurance policy.
export function PolicyForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const { policyForm, setPF, keyDeliveryDate } = useOnboarding()

  return (
    <div className="onboarding-inline-form">
      <div className="onboarding-field">
        <label>סוג ביטוח</label>
        <select className="form-input" value={policyForm.type}
          onChange={e => setPF('type', e.target.value)}>
          {INS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="onboarding-row">
        <div className="onboarding-field">
          <label>חברת ביטוח</label>
          <input type="text" placeholder="שם החברה" value={policyForm.company}
            onChange={e => setPF('company', e.target.value)} />
        </div>
        <div className="onboarding-field">
          <label>פרמיה חודשית (₪)</label>
          <input type="text" inputMode="numeric" placeholder="0"
            value={formatNum(policyForm.monthly_premium)}
            onChange={e => setPF('monthly_premium', e.target.value.replace(/[^\d]/g, ''))} />
        </div>
      </div>
      <div className="onboarding-row">
        <div className="onboarding-field">
          <label>תחילת כיסוי</label>
          <input type="date" value={policyForm.start_date || keyDeliveryDate}
            onChange={e => setPF('start_date', e.target.value)} />
        </div>
        <div className="onboarding-field">
          <label>סיום כיסוי</label>
          <input type="date" value={policyForm.end_date}
            onChange={e => setPF('end_date', e.target.value)} />
        </div>
      </div>
      <p className="onboarding-running-total" style={{ opacity: 0.65 }}>
        הבנק דורש בדרך כלל ביטוח מבנה + ביטוח חיים
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn-onboard-skip" onClick={onCancel}>ביטול</button>
        <button type="button" className="btn-onboard-primary" onClick={onSave}>שמור פוליסה <Check size={14} weight="bold" /></button>
      </div>
    </div>
  )
}
