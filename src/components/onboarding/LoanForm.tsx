import { useEffect, useState } from 'react'
import { Check } from '@phosphor-icons/react'
import { MORTGAGE_TRACK_TYPES } from '../../lib/constants'
import type { TrackType } from '../../types'
import { formatNum } from './types'
import { loanWarnings, type DraftIssue, type IssueField } from './validation'
import { useOnboarding } from './context'
import { DateField } from '../ui/DateField'

// Inline editor for a single supplementary/balloon loan. `alert` carries the
// precise per-field issues after a blocked save: at click time the summary shows
// by the save button (+ red outlines); once the user starts correcting, each
// message moves to sit under its own field instead (owner request).
export function LoanForm({ onSave, onCancel, alert, pulse }: { onSave: () => void; onCancel: () => void; alert?: DraftIssue[] | null; pulse?: number }) {
  const { loanForm, setLF, loanGraceOn, setLoanGraceOn } = useOnboarding()
  const isMonthly = loanForm.repayment_type === 'monthly_fixed'
  const isAnchored = loanForm.track_type === 'prime' || loanForm.track_type === 'variable'
  const [edited, setEdited] = useState(false)
  useEffect(() => { setEdited(false) }, [pulse])
  const change: typeof setLF = (k, v) => { setEdited(true); setLF(k, v) }
  const errFields = new Set((alert ?? []).map(i => i.field))
  const err = (f: IssueField) => errFields.has(f) ? { className: 'input-invalid', 'aria-invalid': true as const } : {}
  const fieldNote = (f: IssueField) => {
    const msg = edited ? (alert ?? []).find(i => i.field === f)?.message : undefined
    return msg ? <span className="onboarding-field-error" role="alert">{msg}</span> : null
  }

  return (
    <div className="onboarding-inline-form">
      {/* Balloon loans moved to the investment step; this step is monthly loans only. */}
      {isMonthly ? (
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>תיאור</label>
            <input type="text" placeholder="הלוואה משלימה" value={loanForm.label}
              onChange={e => change('label', e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label>נותן ההלוואה</label>
            <input type="text" placeholder="בנק" value={loanForm.lender}
              onChange={e => change('lender', e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="onboarding-field">
          <label>שם</label>
          <input type="text" placeholder="הורים" value={loanForm.lender}
            onChange={e => change('lender', e.target.value)} />
        </div>
      )}
      <div className="onboarding-field">
        <label>סכום ההלוואה (₪)</label>
        <input type="text" inputMode="numeric" placeholder="0" {...err('principal')}
          value={formatNum(loanForm.principal)}
          onChange={e => change('principal', e.target.value.replace(/[^\d]/g, ''))} />
        {fieldNote('principal')}
      </div>
      {isMonthly ? (
        <>
          <div className="onboarding-field">
            <label>סוג מסלול</label>
            <select className="form-input" value={loanForm.track_type}
              onChange={e => change('track_type', e.target.value as TrackType)}>
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
                  <input type="number" step="0.01" {...err('rate')}
                    placeholder={loanForm.track_type === 'prime' ? '6' : '3.5'}
                    value={loanForm.prime_rate}
                    onChange={e => change('prime_rate', e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>מרווח % (פריים מינוס = שלילי)</label>
                  <input type="number" step="0.01" {...err('rate')}
                    placeholder={loanForm.track_type === 'prime' ? '-0.5' : '1.5'}
                    value={loanForm.margin}
                    onChange={e => change('margin', e.target.value)} />
                  {fieldNote('rate')}
                </div>
              </div>
              <div className="onboarding-field">
                <label>תקופה (חודשים)</label>
                <input type="number" min="1" placeholder="60" {...err('term')} value={loanForm.term_months}
                  onChange={e => change('term_months', e.target.value)} />
                {fieldNote('term')}
              </div>
            </>
          ) : (
            <div className="onboarding-row">
              <div className="onboarding-field">
                <label>ריבית שנתית (%)</label>
                <input type="number" step="0.01" min="0" placeholder="5" {...err('rate')} value={loanForm.annual_rate}
                  onChange={e => change('annual_rate', e.target.value)} />
                {fieldNote('rate')}
              </div>
              <div className="onboarding-field">
                <label>תקופה (חודשים)</label>
                <input type="number" min="1" placeholder="60" {...err('term')} value={loanForm.term_months}
                  onChange={e => change('term_months', e.target.value)} />
                {fieldNote('term')}
              </div>
            </div>
          )}
          <div className="onboarding-field">
            <label>תאריך התחלה</label>
            <DateField value={loanForm.start_date}
              onChange={v => change('start_date', v)} ariaLabel="תאריך התחלה" />
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
                onChange={e => change('grace_months', e.target.value)}
                dir="ltr"
                style={{ width: 64, marginInlineStart: 8, textAlign: 'center' }}
                placeholder="12" />
            )}
          </label>
        </>
      ) : (
        <p className="onboarding-running-total" style={{ opacity: 0.65 }}>
          הלוואת בלון ללא ריבית — נפרעת במכירה. תופיע בהיבט ההשקעה ומקטינה את ההון העצמי נטו.
        </p>
      )}
      {/* Live plausibility hints (never block saving). */}
      {(() => {
        const warnings = loanWarnings(loanForm)
        return warnings.length > 0 && (
          <div className="onboarding-soft-warning">
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )
      })()}
      {alert && alert.length > 0 && !edited && (
        <div className="onboarding-loan-form-alert" role="alert">
          {alert.map((iss, i) => <div key={i}>{iss.message}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn-onboard-skip" onClick={onCancel}>ביטול</button>
        <button type="button" className="btn-onboard-secondary" onClick={onSave}>שמור הלוואה <Check size={14} weight="bold" /></button>
      </div>
    </div>
  )
}
