import { useState } from 'react'
import { sanitizeAmountInt } from '../../lib/format'
import { Check } from '@phosphor-icons/react'
import { INS_TYPES, formatNum, formatCurrency } from './types'
import { policyIssues, premiumLooksYearly } from './validation'
import { useOnboarding } from './context'
import { DateField } from '../ui/DateField'
import { toMonthly, displayAmount } from '../../lib/premium'

// Inline editor for a single insurance policy. Saving is gated on the shared
// policy rules — an empty policy or an inverted coverage window shows a precise
// note instead of the button silently doing nothing.
export function PolicyForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const { policyForm, setPF, keyDeliveryDate } = useOnboarding()
  const [attempted, setAttempted] = useState(false)
  const issues = policyIssues(policyForm)
  const trySave = () => {
    if (issues.length > 0) setAttempted(true)
    else onSave()
  }
  const noteFor = (f: 'content' | 'dates') =>
    attempted ? issues.find(i => i.field === f)?.message : undefined

  // The premium is stored monthly (the app is monthly-centric), but the user can
  // enter it as a yearly figure — common for insurance — and it's converted. `amount`
  // holds exactly what's typed in the chosen unit so it doesn't drift while typing.
  const [freq, setFreq] = useState<'monthly' | 'yearly'>('monthly')
  const [amount, setAmount] = useState(policyForm.monthly_premium)
  // Exact (possibly fractional) monthly premium — the source of truth for unit
  // toggles, so flipping monthly↔yearly is lossless (1000/yr stays 1000, not 996).
  const [exactMonthly, setExactMonthly] = useState(Number(policyForm.monthly_premium) || 0)
  const monthlyPremium = Number(policyForm.monthly_premium) || 0
  function switchFreq(next: 'monthly' | 'yearly') {
    // Convert from the exact monthly base, not the rounded stored value, so a
    // round-trip (yearly → monthly → yearly) returns the original figure.
    setAmount(exactMonthly ? String(displayAmount(exactMonthly, next)) : '')
    setFreq(next)
  }
  function onAmount(raw: string) {
    const v = sanitizeAmountInt(raw)
    setAmount(v)
    // An empty field must store '' (not '0'), or the policy reads as "has a premium"
    // and a blank policy gets saved.
    if (v === '') { setExactMonthly(0); setPF('monthly_premium', ''); return }
    const em = toMonthly(Number(v) || 0, freq)
    setExactMonthly(em)
    setPF('monthly_premium', String(Math.round(em)))
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
        {freq === 'monthly' && premiumLooksYearly(monthlyPremium) && (
          <span className="onboarding-soft-warning">פרמיה חודשית גבוהה מהרגיל — אם זה הסכום השנתי, עברו למצב "שנתי"</span>
        )}
      </div>
      <div className="onboarding-row">
        <div className="onboarding-field">
          <label>תחילת כיסוי</label>
          <DateField value={policyForm.start_date || keyDeliveryDate}
            onChange={v => setPF('start_date', v)} ariaLabel="תחילת כיסוי" />
        </div>
        <div className="onboarding-field">
          <label>סיום כיסוי</label>
          <DateField value={policyForm.end_date}
            onChange={v => setPF('end_date', v)} ariaLabel="סיום כיסוי"
            className={noteFor('dates') ? 'input-invalid' : ''} />
          {noteFor('dates') && <span className="onboarding-field-error" role="alert">{noteFor('dates')}</span>}
        </div>
      </div>
      <p className="onboarding-running-total" style={{ opacity: 0.65 }}>
        הבנק דורש בדרך כלל ביטוח מבנה + ביטוח חיים
      </p>
      {noteFor('content') && (
        <div className="onboarding-loan-form-alert" role="alert">{noteFor('content')}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn-onboard-skip" onClick={onCancel}>ביטול</button>
        <button type="button" className="btn-onboard-secondary" onClick={trySave}>שמור פוליסה <Check size={14} weight="bold" /></button>
      </div>
    </div>
  )
}
