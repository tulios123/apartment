import { Check } from '@phosphor-icons/react'
import { MORTGAGE_TRACK_TYPES } from '../../lib/constants'
import type { TrackType } from '../../types'
import { formatNum, formatCurrency } from './types'
import { useOnboarding } from './context'

// Inline editor for a single mortgage track. Used both for adding a new track
// and editing a saved one (the parent supplies onSave/onCancel).
export function TrackForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const {
    trackForm, setTF, price, focusedInput, setFocusedInput,
    graceOn, setGraceOn, previewMonthly, previewGrace,
  } = useOnboarding()

  const principalDefault = price > 0 ? String(Math.round(price * 0.75)) : ''
  const primeDefault = trackForm.track_type === 'prime' ? '6.250' : '3.500'
  const marginDefault = trackForm.track_type === 'prime' ? '-0.500' : '1.500'
  const ph = (id: string, val: string, def: string) => ({
    className: !val && !!def && focusedInput !== id ? 'input-ph-grey' : '',
    value: focusedInput === id ? val : (val || def),
    onFocus: () => setFocusedInput(id),
    onBlur: () => setFocusedInput(null),
  })

  return (
    <div className="onboarding-inline-form">
      <div className="onboarding-field">
        <label>סוג מסלול</label>
        <select className="form-input" value={trackForm.track_type}
          onChange={e => setTF('track_type', e.target.value as TrackType)}>
          {MORTGAGE_TRACK_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="onboarding-field">
        <label>קרן (₪)</label>
        <input type="text" inputMode="numeric"
          {...ph('tf.principal', trackForm.principal, principalDefault)}
          value={focusedInput === 'tf.principal'
            ? formatNum(trackForm.principal)
            : formatNum(trackForm.principal || principalDefault)}
          onChange={e => setTF('principal', e.target.value.replace(/\D/g, ''))} />
      </div>
      {(trackForm.track_type === 'prime' || trackForm.track_type === 'variable') ? (
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>{trackForm.track_type === 'prime' ? 'ריבית פריים (%)' : 'עוגן (%)'}</label>
            <input type="number" step="0.01"
              {...ph('tf.prime_rate', trackForm.prime_rate, primeDefault)}
              onChange={e => setTF('prime_rate', e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label>מרווח (%)</label>
            <input type="number" step="0.01"
              {...ph('tf.margin', trackForm.margin, marginDefault)}
              onChange={e => setTF('margin', e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="onboarding-field">
          <label>ריבית שנתית (%)</label>
          <input type="number" step="0.01"
            {...ph('tf.annual_rate', trackForm.annual_rate, '5.000')}
            onChange={e => setTF('annual_rate', e.target.value)} />
        </div>
      )}
      <div className="onboarding-row">
        <div className="onboarding-field">
          <label>תקופה (חודשים)</label>
          <input type="number" min="1"
            {...ph('tf.term', trackForm.term_months, '360')}
            onChange={e => setTF('term_months', e.target.value)} />
        </div>
        <div className="onboarding-field">
          <label>תאריך התחלה</label>
          <input type="date" value={trackForm.start_date}
            onChange={e => setTF('start_date', e.target.value)} />
        </div>
      </div>
      <label className="onboarding-checkbox-row">
        <input type="checkbox" checked={graceOn}
          onChange={e => {
            setGraceOn(e.target.checked)
            setTF('grace_months', e.target.checked ? '12' : '')
          }} />
        <span>גרייס (חודשי ריבית בלבד)</span>
        {graceOn && (
          <input type="number" min="1" max="24" value={trackForm.grace_months}
            onChange={e => setTF('grace_months', e.target.value)}
            dir="ltr"
            style={{ width: 64, marginRight: 8, textAlign: 'center' }}
            placeholder="12" />
        )}
      </label>
      {previewMonthly > 0 && (
        <div className="onboarding-running-total">
          {graceOn && previewGrace > 0 ? (
            <>
              <div>בגרייס: <strong>{formatCurrency(previewGrace)}</strong> / חודש</div>
              <div>לאחר גרייס: <strong>{formatCurrency(previewMonthly)}</strong> / חודש</div>
            </>
          ) : (
            <div>תשלום חודשי משוער: <strong>{formatCurrency(previewMonthly)}</strong></div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn-onboard-skip" onClick={onCancel}>ביטול</button>
        <button type="button" className="btn-onboard-primary" onClick={onSave}>שמור מסלול <Check size={14} weight="bold" /></button>
      </div>
    </div>
  )
}
