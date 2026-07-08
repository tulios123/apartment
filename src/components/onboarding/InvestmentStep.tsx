import { useState, type ChangeEvent } from 'react'
import { Coins, X } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { FinishEarly } from './FinishEarly'
import {
  formatNum, formatCurrency,
  defaultLawyerCost, defaultBrokerageCost,
} from './types'
import { useOnboarding } from './context'

export function InvestmentStep() {
  const {
    advance, price,
    equityMode, setEquityMode, equityValue, setEquityValue,
    focusedInput, setFocusedInput, equityAmount, equityPercent,
    derivedEquityAmount, derivedEquityPct,
    balloonLoans, setBalloonLoans, balloonTotal,
    costs, setCosts, extraCosts, setExtraCosts, costsTotal,
    fillTestInvestment,
  } = useOnboarding()

  // Which balloon row is expanded for editing; others collapse to a compact summary
  // so the list stays tidy as more family lenders are added.
  const [editBalloon, setEditBalloon] = useState<number | null>(null)

  return (
    <form noValidate onSubmit={e => { e.preventDefault(); advance('rental') }}>
      <StepHeader current="investment" icon={<Coins size={44} color="var(--accent)" />} title="הון עצמי ועלויות" />
      <FillExampleTop onFill={fillTestInvestment} />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>
      <div className="onboarding-form">
        {/* Equity */}
        <div className="onboarding-field">
          <label>הון עצמי <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>· מחושב: מחיר הרכישה − משכנתא (ניתן לשנות)</span></label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="toggle-group" style={{ flexShrink: 0 }}>
              <button type="button" className={`toggle-btn${equityMode === 'amount' ? ' active' : ''}`}
                onClick={() => { setEquityMode('amount'); setEquityValue('') }}>₪</button>
              <button type="button" className={`toggle-btn${equityMode === 'percent' ? ' active' : ''}`}
                onClick={() => { setEquityMode('percent'); setEquityValue('') }}>%</button>
            </div>
            {(() => {
              const eqDefRaw = equityMode === 'percent'
                ? (derivedEquityPct > 0 ? String(derivedEquityPct) : '')
                : (derivedEquityAmount > 0 ? String(derivedEquityAmount) : '')
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
                  onFocus={() => setFocusedInput('equity')}
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
              הזינו מחיר רכישה כדי לחשב אחוז
            </p>
          )}
        </div>

        {/* Balloon loans — interest-free, repaid only on sale; offset equity. A list so
            several family lenders (50 from mom, 50 from dad…) can be captured separately. */}
        <div className="onboarding-field">
          <label>הלוואות בלון <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>· ללא ריבית, נפרעות במכירה</span></label>
          {balloonLoans.map((b, i) => {
            // Filled rows collapse to a compact chip; the one being edited (or any still
            // empty) stays expanded. Adding a new row collapses the previous.
            const expanded = editBalloon === i || !b.amount
            if (!expanded) {
              return (
                <div key={i} className="onboarding-balloon-chip">
                  <button type="button" className="onboarding-balloon-chip-main" onClick={() => setEditBalloon(i)}>
                    {formatCurrency(parseFloat(b.amount) || 0)}
                    {b.lender.trim() && <span className="text-muted"> · {b.lender.trim()}</span>}
                  </button>
                  <button type="button" className="onboarding-balloon-chip-remove" aria-label="מחיקת הלוואת בלון"
                    onClick={e => { e.stopPropagation(); setEditBalloon(null); setBalloonLoans(prev => prev.filter((_, j) => j !== i)) }}>
                    <X size={14} />
                  </button>
                </div>
              )
            }
            return (
              <div className="onboarding-row" key={i} style={{ marginBottom: 8 }}>
                <div className="onboarding-field">
                  <input type="text" inputMode="numeric" placeholder="סכום" autoFocus={editBalloon === i}
                    value={formatNum(b.amount)}
                    onChange={e => setBalloonLoans(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value.replace(/[^\d]/g, '') } : r))} />
                </div>
                <div className="onboarding-field">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="text" placeholder="ממי (למשל: אמא)"
                      value={b.lender}
                      onChange={e => setBalloonLoans(prev => prev.map((r, j) => j === i ? { ...r, lender: e.target.value } : r))} />
                    <button type="button" aria-label="מחיקת הלוואת בלון" onClick={() => { setEditBalloon(null); setBalloonLoans(prev => prev.filter((_, j) => j !== i)) }}
                      style={{ flexShrink: 0, padding: '0 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          <button type="button" className="btn-onboard-skip onboarding-add-btn"
            onClick={() => { setEditBalloon(balloonLoans.length); setBalloonLoans(prev => [...prev, { amount: '', lender: '' }]) }}>
            + הוסף הלוואת בלון
          </button>
        </div>

        <p className="onboarding-subhead">עלויות רכישה ונלוות</p>
        <p className="onboarding-field-hint" style={{ marginTop: -2, marginBottom: 2 }}>
          המספרים האפורים הם הערכה לפי שיעורים מקובלים והם יישמרו כפי שמוצג. ערכו אם שונה — או אפסו אם לא רלוונטי (למשל קנייה ללא תיווך).
        </p>

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
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>שמאי (₪)</label>
                  <input type="text" inputMode="numeric" placeholder="0"
                    value={formatNum(costs.appraiser ?? '')}
                    onChange={e => setCosts(c => ({ ...c, appraiser: e.target.value.replace(/[^\d]/g, '') }))} />
                </div>
                <div className="onboarding-field" />
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
                      <button type="button" aria-label="מחיקת עלות" onClick={() => setExtraCosts(prev => prev.filter((_, j) => j !== i))}
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
            {balloonTotal > 0 ? (
              <>
                <div>סך ההשקעה: <strong>{formatCurrency(equityAmount + costsTotal)}</strong></div>
                <div style={{ marginTop: 2 }}>ההון שלך בפועל בניכוי בלון: <strong>{formatCurrency(equityAmount + costsTotal - balloonTotal)}</strong></div>
              </>
            ) : (
              <>סה״כ הושקע: <strong>{formatCurrency(equityAmount + costsTotal)}</strong></>
            )}
          </div>
        )}
      </div>
      <button type="submit" className="btn-onboard-primary onboarding-cta-full">המשך</button>
      <FinishEarly />
    </form>
  )
}
