import { useId, useState, type ChangeEvent } from 'react'
import { sanitizeAmountInt } from '../../lib/format'
import { purchaseTax, taxBreakdown } from '../../lib/purchaseTax'
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
    advance, price, error,
    equityMode, setEquityMode, equityValue, setEquityValue,
    focusedInput, setFocusedInput, equityAmount, equityPercent,
    derivedEquityAmount, derivedEquityPct,
    balloonLoans, setBalloonLoans, balloonTotal,
    costs, setCosts, extraCosts, setExtraCosts, costsTotal,
    singleApartment, setSingleApartment, taxDefault,
    fillTestInvestment,
  } = useOnboarding()

  // The tax brackets, folded. The number itself is the answer; the ladder is there for
  // the one person in ten who wants to check it against the Tax Authority's calculator.
  const [showBrackets, setShowBrackets] = useState(false)
  // The rarer costs start folded — unless this account already has one, in which case
  // hiding it would be hiding data. Derived rather than initial state on purpose:
  // hydrating an existing account fills `costs` AFTER mount, and a lazy initializer would
  // have missed it and folded away numbers the user had already entered.
  const [showMoreManual, setShowMoreManual] = useState(false)
  const showMore = showMoreManual
    || !!(costs.mortgage_advisor || costs.investment_company || costs.appraiser || extraCosts.length)

  // Which balloon row is expanded for editing; others collapse to a compact summary
  // so the list stays tidy as more family lenders are added.
  const [editBalloon, setEditBalloon] = useState<number | null>(null)
  // The cost boxes had decorative labels only, so each was announced as an unnamed edit
  // box and its label focused nothing (docs/audit/a11y-forms.md). The focus key each one
  // already carries ('c.lawyer', …) doubles as the DOM id.
  const uid = useId()
  const fid = (k: string) => `${uid}-${k.replace(/\./g, '-')}`

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
                    aria-label="הון עצמי (₪)"
                    type="text" inputMode="numeric"
                    className={isGrey ? 'input-ph-grey' : ''}
                    value={displayVal}
                    onFocus={() => setFocusedInput('equity')}
                    onBlur={() => setFocusedInput(null)}
                    onChange={e => setEquityValue(sanitizeAmountInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                )
              }
              return (
                <input
                  aria-label="הון עצמי (%)"
                  type="number" min="0" max="100" step="0.1"
                  className={isGrey ? 'input-ph-grey' : ''}
                  value={focusedInput === 'equity' ? equityValue : (equityValue || eqDefRaw)}
                  onFocus={() => setFocusedInput('equity')}
                  onBlur={() => setFocusedInput(null)}
                  // W4: `max` doesn't constrain TYPED values — clamp so an equity
                  // percent above 100 can't corrupt the stored self_equity.
                  onChange={e => {
                    const v = e.target.value
                    setEquityValue(v !== '' && Number(v) > 100 ? '100' : v)
                  }}
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
                    onChange={e => setBalloonLoans(prev => prev.map((r, j) => j === i ? { ...r, amount: sanitizeAmountInt(e.target.value) } : r))} />
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
            id: fid(id),
            type: 'text' as const,
            inputMode: 'numeric' as const,
            className: !val && !!def && focusedInput !== id ? 'input-ph-grey' : '',
            value: focusedInput === id ? formatNum(val) : formatNum(val || def),
            onFocus: () => setFocusedInput(id),
            onBlur: () => setFocusedInput(null),
            onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(sanitizeAmountInt(e.target.value)),
          })
          /** His own figure as a share of the price, once he has overridden the estimate. */
          const costHint = (raw: string, formula: string) => {
            const v = Number(raw)
            if (!(v > 0) || !(price > 0)) return formula
            return `${(v / price * 100).toFixed(2)}% ממחיר הדירה`
          }
          return (
            <>
              {/* מס רכישה — Omer's note 5: the costs step asked about the lawyer and the
                  agent and never mentioned the one cost fixed by law, which is usually the
                  largest of them. Same contract as the lawyer fee (owner 21.09): computed,
                  itemised, and editable. It sits first because it is the biggest. */}
              <div className="onboarding-field onboarding-tax">
                <label htmlFor={fid('c.purchase_tax')}>מס רכישה (₪)</label>
<div className="toggle-group onboarding-tax-toggle-group">
                  <button type="button" className={`toggle-btn${singleApartment ? ' active' : ''}`}
                    onClick={() => setSingleApartment(true)}>דירה יחידה</button>
                  <button type="button" className={`toggle-btn${!singleApartment ? ' active' : ''}`}
                    onClick={() => setSingleApartment(false)}>דירה נוספת</button>
                </div>
                <input {...inp('c.purchase_tax', costs.purchase_tax, taxDefault, v => setCosts(c => ({ ...c, purchase_tax: v })))} />
                {price > 0 ? (
                  <>
                    <button type="button" className="onboarding-tax-toggle" onClick={() => setShowBrackets(b => !b)}>
                      {showBrackets ? 'הסתר את המדרגות' : 'איך חושב?'}
                    </button>
                    {showBrackets && (
                      <div className="onboarding-tax-brackets">
                        {taxBreakdown(price, singleApartment).map((b, i) => (
                          <div key={i} className="onboarding-tax-bracket">
                            <span>{b.label}</span>
                            <b>{formatCurrency(b.amount)}</b>
                          </div>
                        ))}
                        <div className="onboarding-tax-bracket onboarding-tax-bracket-sum">
                          <span>{singleApartment ? 'דירה יחידה' : 'דירה נוספת'} · סה״כ</span>
                          <b>{formatCurrency(purchaseTax(price, singleApartment))}</b>
                        </div>
                        <p className="onboarding-field-hint">
                          לפי מדרגות מס הרכישה התקפות היום. המחשבון של רשות המסים הוא המילה האחרונה.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="onboarding-field-hint">יחושב אוטומטית ברגע שיוזן מחיר רכישה</span>
                )}
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label htmlFor={fid('c.lawyer')}>עורך דין (₪)</label>
                  <input {...inp('c.lawyer', costs.lawyer, lawyerDef, v => setCosts(c => ({ ...c, lawyer: v })))} />
                  {/* The hint describes the ESTIMATE's formula. Once his own number is in
                      the box it stopped describing anything on screen but stayed anyway
                      (Omer, note 6), so past that point it says what his number actually
                      is as a share of the price. */}
                  <span className="onboarding-field-hint">{costHint(costs.lawyer, '0.5% + ₪1,000 + מע"מ 18%')}</span>
                </div>
                <div className="onboarding-field">
                  <label htmlFor={fid('c.brokerage')}>דמי תיווך (₪)</label>
                  <input {...inp('c.brokerage', costs.brokerage, brokerageDef, v => setCosts(c => ({ ...c, brokerage: v })))} />
                  <span className="onboarding-field-hint">{costHint(costs.brokerage, '2% + מע"מ 18%')}</span>
                </div>
              </div>
              {/* The three costs nearly everyone has are above; these are the ones most
                  people leave at zero. Folding them is the "מה שאפשר לקפל לקפל" half of the
                  owner's answer on shortening the wizard (21.09) — the step loses four empty
                  boxes without losing a field. Opens by itself when any of them has a value,
                  so a returning account never has data hidden behind a caret. */}
              {!showMore && (
                <button type="button" className="btn-onboard-skip onboarding-add-btn"
                  onClick={() => setShowMoreManual(true)}>
                  + עלויות נוספות (יועץ, ליווי, שמאי)
                </button>
              )}
              {showMore && <>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label htmlFor={fid('c.advisor')}>יועץ משכנתאות (₪)</label>
                  <input id={fid('c.advisor')} type="text" inputMode="numeric" placeholder="0"
                    value={formatNum(costs.mortgage_advisor)}
                    onChange={e => setCosts(c => ({ ...c, mortgage_advisor: sanitizeAmountInt(e.target.value) }))} />
                </div>
                <div className="onboarding-field">
                  <label htmlFor={fid('c.escort')}>חברת ליווי השקעה (₪)</label>
                  <input id={fid('c.escort')} type="text" inputMode="numeric" placeholder="0"
                    value={formatNum(costs.investment_company)}
                    onChange={e => setCosts(c => ({ ...c, investment_company: sanitizeAmountInt(e.target.value) }))} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label htmlFor={fid('c.appraiser')}>שמאי (₪)</label>
                  <input id={fid('c.appraiser')} type="text" inputMode="numeric" placeholder="0"
                    value={formatNum(costs.appraiser ?? '')}
                    onChange={e => setCosts(c => ({ ...c, appraiser: sanitizeAmountInt(e.target.value) }))} />
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
                        onChange={e => setExtraCosts(prev => prev.map((c, j) => j === i ? { ...c, amount: sanitizeAmountInt(e.target.value) } : c))} />
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
              </>}
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
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      <FinishEarly />
    </form>
  )
}
