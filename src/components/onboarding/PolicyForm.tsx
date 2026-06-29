import { useState } from 'react'
import { Check } from '@phosphor-icons/react'
import { INS_TYPES, formatNum, formatCurrency } from './types'
import { useOnboarding } from './context'

// Inline editor for a single insurance policy.
export function PolicyForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const { policyForm, setPF, keyDeliveryDate } = useOnboarding()

  // The premium is stored monthly (the app is monthly-centric), but the user can
  // enter it as a yearly figure — common for insurance — and it's converted. `amount`
  // holds exactly what's typed in the chosen unit so it doesn't drift while typing.
  const [freq, setFreq] = useState<'monthly' | 'yearly'>('monthly')
  const [amount, setAmount] = useState(policyForm.monthly_premium)
  const monthlyPremium = Number(policyForm.monthly_premium) || 0
  function switchFreq(next: 'monthly' | 'yearly') {
    setAmount(next === 'yearly' ? String(monthlyPremium * 12) : String(monthlyPremium))
    setFreq(next)
  }
  function onAmount(raw: string) {
    const v = raw.replace(/[^\d]/g, '')
    setAmount(v)
    // An empty field must store '' (not '0'), or the policy reads as "has a premium"
    // and a blank policy gets saved.
    const monthly = v === '' ? '' : (freq === 'yearly' ? String(Math.round((Number(v) || 0) / 12)) : v)
    setPF('monthly_premium', monthly)
  }

  return (
    <div className="onboarding-inline-form">
      <div className="onboarding-field">
        <label>סוג ביטוח</label>
        <select className="form-input" value={policyForm.type}
          onChange={e => setPF('type', e.target.value)}>
          {INS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="onboarding-field">
        <label>חברת ביטוח</label>
        <input type="text" placeholder="שם החברה" value={policyForm.company}
          onChange={e => setPF('company', e.target.value)} />
      </div>
      <div className="onboarding-field">
        <label>פרמיה (₪)</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="toggle-group" style={{ flexShrink: 0 }}>
            <button type="button" className={`toggle-btn${freq === 'monthly' ? ' active' : ''}`} onClick={() => switchFreq('monthly')}>חודשי</button>
            <button type="button" className={`toggle-btn${freq === 'yearly' ? ' active' : ''}`} onClick={() => switchFreq('yearly')}>שנתי</button>
          </div>
          <input type="text" inputMode="numeric" placeholder="0" style={{ flex: 1 }}
            value={formatNum(amount)}
            onChange={e => onAmount(e.target.value)} />
        </div>
        {freq === 'yearly' && monthlyPremium > 0 && (
          <span className="onboarding-field-hint">≈ {formatCurrency(monthlyPremium)} לחודש</span>
        )}
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
