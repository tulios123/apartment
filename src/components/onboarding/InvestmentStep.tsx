import type { ChangeEvent } from 'react'
import { Coins, ArrowLeft, ArrowRight, X } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FinishEarly } from './FinishEarly'
import {
  formatNum, formatCurrency,
  defaultLawyerCost, defaultBrokerageCost, defaultSelfEquityPct,
} from './types'
import { useOnboarding } from './context'

export function InvestmentStep() {
  const {
    advance, back, price,
    equityMode, setEquityMode, equityValue, setEquityValue,
    focusedInput, setFocusedInput, equityAmount, equityPercent,
    balloonAmount, setBalloonAmount, balloonLender, setBalloonLender,
    costs, setCosts, extraCosts, setExtraCosts, costsTotal,
    showFillExample, fillTestInvestment,
  } = useOnboarding()

  return (
    <form onSubmit={e => { e.preventDefault(); advance('rental') }}>
      <StepHeader current="investment" icon={<Coins size={44} color="var(--accent)" />} title="הון עצמי ועלויות" />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>
      <div className="onboarding-form">
        {/* Equity */}
        <div className="onboarding-field">
          <label>הון עצמי <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>· מחושב: מחיר − משכנתא − הלוואות (ניתן לשנות)</span></label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="toggle-group" style={{ flexShrink: 0 }}>
              <button type="button" className={`toggle-btn${equityMode === 'amount' ? ' active' : ''}`}
                onClick={() => { setEquityMode('amount'); setEquityValue('') }}>₪</button>
              <button type="button" className={`toggle-btn${equityMode === 'percent' ? ' active' : ''}`}
                onClick={() => { setEquityMode('percent'); setEquityValue('') }}>%</button>
            </div>
            {(() => {
              const eqDefRaw = equityMode === 'percent'
                ? defaultSelfEquityPct()
                : (price > 0 ? String(Math.round(price * 0.25)) : '')
              const isGrey = !equityValue && !!eqDefRaw && focusedInput !== 'equity'
              if (equityMode === 'amount') {
                const displayVal = focusedInput === 'equity'
                  ? formatNum(equityValue)
                  : formatNum(equityValue || eqDefRaw)
                return (
                  <input
                    type="text" inputMode="numeric"
                    className={isGrey ? 'input-ph-grey' : ''}
                    value={displayVal}
                    onFocus={() => setFocusedInput('equity')}
                    onBlur={() => setFocusedInput(null)}
                    onChange={e => setEquityValue(e.target.value.replace(/\D/g, ''))}
                    style={{ flex: 1 }}
                  />
                )
              }
              return (
                <input
                  type="number" min="0" step="0.1"
                  className={isGrey ? 'input-ph-grey' : ''}
                  value={focusedInput === 'equity' ? equityValue : (equityValue || eqDefRaw)}
                  onFocus={() => { setFocusedInput('equity'); if (!equityValue) setEquityValue('0') }}
                  onBlur={() => setFocusedInput(null)}
                  onChange={e => setEquityValue(e.target.value)}
                  style={{ flex: 1 }}
                />
              )
            })()}
          </div>
          {price > 0 && (
            <p className="onboarding-running-total" style={{ marginTop: 4 }}>
              {equityMode === 'percent'
                ? <>= {formatCurrency(equityAmount)} מתוך {formatCurrency(price)}</>
                : <>= {equityPercent.toFixed(1)}% ממחיר הרכישה</>
              }
            </p>
          )}
          {price === 0 && (
            <p className="onboarding-running-total" style={{ marginTop: 4, opacity: 0.6 }}>
              הזן מחיר רכישה כדי לחשב אחוז
            </p>
          )}
        </div>

        {/* Balloon loan — interest-free, repaid only on sale; offsets equity */}
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>הלוואת בלון <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>· ללא ריבית, נפרעת במכירה</span></label>
            <input type="text" inputMode="numeric" placeholder="0"
              value={formatNum(balloonAmount)}
              onChange={e => setBalloonAmount(e.target.value.replace(/[^\d]/g, ''))} />
          </div>
          <div className="onboarding-field">
            <label>ממי (אופציונלי)</label>
            <input type="text" placeholder="למשל: הורים"
              value={balloonLender}
              onChange={e => setBalloonLender(e.target.value)} />
          </div>
        </div>

        {/* Cost fields */}
        {(() => {
          const lawyerDef = defaultLawyerCost(price)
          const brokerageDef = defaultBrokerageCost(price)
          const inp = (id: string, val: string, def: string, onChange: (v: string) => void) => ({
            type: 'text' as const,
            inputMode: 'numeric' as const,
            className: !val && !!def && focusedInput !== id ? 'input-ph-grey' : '',
            value: focusedInput === id ? formatNum(val) : formatNum(val || def),
            onFocus: () => setFocusedInput(id),
            onBlur: () => setFocusedInput(null),
            onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value.replace(/[^\d]/g, '')),
          })
          return (
            <>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>עורך דין (₪)</label>
                  <input {...inp('c.lawyer', costs.lawyer, lawyerDef, v => setCosts(c => ({ ...c, lawyer: v })))} />
                  <span className="onboarding-field-hint">0.5% + ₪1,000 + מע"מ 18%</span>
                </div>
                <div className="onboarding-field">
                  <label>דמי תיווך (₪)</label>
                  <input {...inp('c.brokerage', costs.brokerage, brokerageDef, v => setCosts(c => ({ ...c, brokerage: v })))} />
                  <span className="onboarding-field-hint">2% + מע"מ 18%</span>
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>יועץ משכנתאות (₪)</label>
                  <input type="text" inputMode="numeric" placeholder="0"
                    value={formatNum(costs.mortgage_advisor)}
                    onChange={e => setCosts(c => ({ ...c, mortgage_advisor: e.target.value.replace(/[^\d]/g, '') }))} />
                </div>
                <div className="onboarding-field">
                  <label>חברת ליווי השקעה (₪)</label>
                  <input type="text" inputMode="numeric" placeholder="0"
                    value={formatNum(costs.investment_company)}
                    onChange={e => setCosts(c => ({ ...c, investment_company: e.target.value.replace(/[^\d]/g, '') }))} />
                </div>
              </div>
              {/* Extra custom costs */}
              {extraCosts.map((ec, i) => (
                <div className="onboarding-row" key={i}>
                  <div className="onboarding-field">
                    <label>שם עלות</label>
                    <input type="text" placeholder="תיאור" value={ec.name}
                      onChange={e => setExtraCosts(prev => prev.map((c, j) => j === i ? { ...c, name: e.target.value } : c))} />
                  </div>
                  <div className="onboarding-field">
                    <label>סכום (₪)</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="text" inputMode="numeric" placeholder="0"
                        value={formatNum(ec.amount)}
                        onChange={e => setExtraCosts(prev => prev.map((c, j) => j === i ? { ...c, amount: e.target.value.replace(/[^\d]/g, '') } : c))} />
                      <button type="button" onClick={() => setExtraCosts(prev => prev.filter((_, j) => j !== i))}
                        style={{ flexShrink: 0, padding: '0 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="btn-onboard-skip onboarding-add-btn"
                onClick={() => setExtraCosts(prev => [...prev, { name: '', amount: '' }])}>
                + הוסף עלות
              </button>
            </>
          )
        })()}

        {(equityAmount + costsTotal) > 0 && (
          <div className="onboarding-running-total">
            סה״כ הושקע: <strong>{formatCurrency(equityAmount + costsTotal)}</strong>
          </div>
        )}
      </div>
      <div className="onboarding-actions">
        <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
        {showFillExample && (
          <button type="button" className="btn-onboard-skip" onClick={fillTestInvestment}>מלא דוגמה</button>
        )}
        <button type="submit" className="btn-onboard-primary">הבא <ArrowLeft size={16} /></button>
      </div>
      <FinishEarly />
    </form>
  )
}
