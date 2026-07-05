import { Check } from '@phosphor-icons/react'
import { MORTGAGE_TRACK_TYPES } from '../../lib/constants'
import type { TrackType } from '../../types'
import { formatNum } from './types'
import { useOnboarding } from './context'
import { DateField } from '../ui/DateField'

// Inline editor for a single supplementary/balloon loan.
export function LoanForm({ onSave, onCancel, alert }: { onSave: () => void; onCancel: () => void; alert?: string[] | null }) {
  const { loanForm, setLF, loanGraceOn, setLoanGraceOn } = useOnboarding()
  const isMonthly = loanForm.repayment_type === 'monthly_fixed'
  const isAnchored = loanForm.track_type === 'prime' || loanForm.track_type === 'variable'

  return (
    <div className="onboarding-inline-form">
      {/* Balloon loans moved to the investment step; this step is monthly loans only. */}
      {isMonthly ? (
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>תיאור</label>
            <input type="text" placeholder="הלוואה משלימה" value={loanForm.label}
              onChange={e => setLF('label', e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label>נותן ההלוואה</label>
            <input type="text" placeholder="בנק" value={loanForm.lender}
              onChange={e => setLF('lender', e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="onboarding-field">
          <label>שם</label>
          <input type="text" placeholder="הורים" value={loanForm.lender}
            onChange={e => setLF('lender', e.target.value)} />
        </div>
      )}
      <div className="onboarding-field">
        <label>סכום ההלוואה (₪)</label>
        <input type="text" inputMode="numeric" placeholder="0"
          value={formatNum(loanForm.principal)}
          onChange={e => setLF('principal', e.target.value.replace(/[^\d]/g, ''))} />
      </div>
      {isMonthly ? (
        <>
          <div className="onboarding-field">
            <label>סוג מסלול</label>
            <select className="form-input" value={loanForm.track_type}
              onChange={e => setLF('track_type', e.target.value as TrackType)}>
              {MORTGAGE_TRACK_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {isAnchored ? (
            <>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>{loanForm.track_type === 'prime' ? 'ריבית פריים (%)' : 'עוגן (%)'}</label>
                  <input type="number" step="0.01"
                    placeholder={loanForm.track_type === 'prime' ? '6.000' : '3.500'}
                    value={loanForm.prime_rate}
                    onChange={e => setLF('prime_rate', e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>מרווח % (פריים מינוס = שלילי)</label>
                  <input type="number" step="0.01"
                    placeholder={loanForm.track_type === 'prime' ? '-0.500' : '1.500'}
                    value={loanForm.margin}
                    onChange={e => setLF('margin', e.target.value)} />
                </div>
              </div>
              <div className="onboarding-field">
                <label>תקופה (חודשים)</label>
                <input type="number" min="1" placeholder="60" value={loanForm.term_months}
                  onChange={e => setLF('term_months', e.target.value)} />
              </div>
            </>
          ) : (
            <div className="onboarding-row">
              <div className="onboarding-field">
                <label>ריבית שנתית (%)</label>
                <input type="number" step="0.01" min="0" placeholder="5.000" value={loanForm.annual_rate}
                  onChange={e => setLF('annual_rate', e.target.value)} />
              </div>
              <div className="onboarding-field">
                <label>תקופה (חודשים)</label>
                <input type="number" min="1" placeholder="60" value={loanForm.term_months}
                  onChange={e => setLF('term_months', e.target.value)} />
              </div>
            </div>
          )}
          <div className="onboarding-field">
            <label>תאריך התחלה</label>
            <DateField value={loanForm.start_date}
              onChange={v => setLF('start_date', v)} ariaLabel="תאריך התחלה" />
          </div>
          <label className="onboarding-checkbox-row">
            <input type="checkbox" checked={loanGraceOn}
              onChange={e => {
                setLoanGraceOn(e.target.checked)
                setLF('grace_months', e.target.checked ? '12' : '')
              }} />
            <span>גרייס (חודשי ריבית בלבד)</span>
            {loanGraceOn && (
              <input type="number" min="1" max="24" value={loanForm.grace_months}
                onChange={e => setLF('grace_months', e.target.value)}
                dir="ltr"
                style={{ width: 64, marginRight: 8, textAlign: 'center' }}
                placeholder="12" />
            )}
          </label>
        </>
      ) : (
        <p className="onboarding-running-total" style={{ opacity: 0.65 }}>
          הלוואת בלון ללא ריבית — נפרעת במכירה. תופיע בהיבט ההשקעה ומקטינה את ההון העצמי נטו.
        </p>
      )}
      {alert && alert.length > 0 && (
        <div className="onboarding-loan-form-alert" role="alert">חסר {alert.join(' · ')}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn-onboard-skip" onClick={onCancel}>ביטול</button>
        <button type="button" className="btn-onboard-primary" onClick={onSave}>שמור הלוואה <Check size={14} weight="bold" /></button>
      </div>
    </div>
  )
}
