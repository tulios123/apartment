import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { PencilSimple, CaretLeft, CaretRight, Question } from '@phosphor-icons/react'
import InvestmentCosts from '../property/InvestmentCosts'
import LiabilitiesV2 from '../liabilities/LiabilitiesV2'
import OwnershipScore from './OwnershipScore'
import WealthAccelerator from './WealthAccelerator'
import MonthlyResult from './MonthlyResult'
import FinancingStructure from './FinancingStructure'
import { DealStructure } from './DealStructure'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useMortgageData } from '../../hooks/useMortgageData'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { useLoansData } from '../../hooks/useLoansData'
import { currentSplitInfo, futureSplit, principalNext12Months, interestNext12Months, splitForMonth } from '../../lib/equity'
import { formatCurrency, todayISO, daysBetween, monthEndISO } from '../../lib/format'
import { useInsurance } from '../../hooks/useInsurance'
import { activeContract as findActiveContract } from '../../lib/projections'
import { possession } from '../../lib/stage'
import { loadPlan } from '../../lib/purchasePlan'
import { useAuth } from '../../contexts/AuthContext'
import { MAINTENANCE_CATEGORY } from '../../lib/constants'
import { SkeletonList } from '../../components/ui/Skeleton'
import { EmptyState, PageError } from '../../components/ui/EmptyState'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
import './wealth.css'

const fmt = (v: number) => formatCurrency(v)

export default function WealthHub() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [yieldHelp, setYieldHelp] = useState(false)

  const { property, contracts, loading: loadingProp, error: errProp, refetch: refetchProp } = usePropertyData()
  const { tracks, summary, loading: loadingMortgage, error: errMortgage, refetch: refetchMortgage } = useMortgageData()
  const { costs, totalInvested, rentReceived, interestPaid, maintenance, loading: loadingInv, error: errInv, refetch: refetchInv } = useInvestmentData()
  const { monthlyLoans, balloonLoans, summary: loansSummary, loading: loadingLoans, error: errLoans, refetch: refetchLoans } = useLoansData()
  // Loaded here for the first time — see the note on monthlyInsurance below.
  const { policies } = useInsurance()

  // Before the key nothing on this screen has happened yet: no payment has been made, the
  // mortgage has not been drawn, and the flat is not part-owned. Judgement is therefore
  // silent here — what stays is the composition, which is true from the day of signing.
  // (Owner, 09.09: "בהון נעשה את מבנה המימון המלא וכל מבנה העסקה הסופי".)
  const awaitingKey = possession(property?.key_delivery_date, todayISO()) === 'awaiting_key'
  const plan = user?.id ? loadPlan(user.id) : null
  // Purchase tax is his money and often his largest cost after the equity, but it is not
  // an investment_cost row — only the plan knows it. Passing the FIGURE (not a total) keeps
  // מבנה העסקה adding up its own rows; see the note in DealStructure.
  const planTax = plan ? plan.items.find(i => i.id === 'tax-pay')?.amount : undefined

  const statsLoading = loadingProp || loadingMortgage || loadingInv || loadingLoans
  const loadError = errProp || errMortgage || errInv || errLoans

  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const bankDebt = mortgageBalance + (loansSummary.monthlyBalance || 0)
  const balloon = loansSummary.balloonOutstanding || 0

  // `split.isCurrentMonth` is false when nothing is actually paid this month and the
  // figures come from the first month that does pay (a buyer before drawdown, an owner
  // in grace). Every sentence phrased in the present tense is gated on it.
  const split = currentSplitInfo(tracks, monthlyLoans)
  // Owner (21.07): the monthly card lumped mortgage interest and loan interest into one
  // line labelled "ריבית המשכנתא". Break the SAME month down per vehicle so each is named.
  const splitMonth = split.month
  const mortgageSplit = splitForMonth(tracks, [], splitMonth)
  const loansSplit = splitForMonth([], monthlyLoans, splitMonth)
  const future5y = futureSplit(tracks, monthlyLoans, 60)
  const annualPrincipal = principalNext12Months(tracks, monthlyLoans)

  /**
   * In a grace period the bank takes interest only: nothing at all is converted to equity.
   * The accelerator — whose entire subject is how much of each payment builds equity —
   * therefore showed "בונה הון ₪0 (0%)" beside a full interest bar, as if the owner were
   * choosing badly rather than being in a window where the choice does not exist yet
   * (Omer, note 19). The owner's call (21.09): hide it during grace, with a line that can
   * be expanded.
   *
   * Detected from the schedule rather than from grace_months, so it is right for every
   * reason a month can be interest-only, and the resume month is found by asking the
   * schedule when principal next appears — which is the honest answer to "from when".
   */
  const inGrace = split.total > 0 && split.principal <= 0
  const accelResumes = useMemo(() => {
    if (!inGrace) return null
    const [y, m] = splitMonth.split('-').map(Number)
    for (let i = 1; i <= 36; i++) {
      const d = new Date(y, m - 1 + i, 1)
      const mm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (splitForMonth(tracks, monthlyLoans, mm).principal > 0) return mm
    }
    return null
  }, [inGrace, splitMonth, tracks, monthlyLoans])

  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0

  /**
   * Insurance — the expense this screen did not know existed.
   *
   * WealthHub never loaded the policies, so "הרווח החודשי האמיתי" was rent minus interest
   * minus upkeep, with the premium missing, while the תזרים screen counted it (the forecast
   * engine has always included it). The two screens each announced "the real profit" for the
   * same month and gave answers 110 apart — night run C2-B, and the owner cleared this one
   * to fix on 21.09.
   *
   * Not a redefinition: תזרים is the reference and this brings Wealth to it. The same figure
   * also enters the annual cash used by the yields below, because a card and a yield on ONE
   * screen disagreeing about whether insurance exists would be worse than the original bug.
   *
   * Active-in-month test mirrors monthlyVirtualEntries exactly, so the two engines can't
   * drift on which policies count.
   */
  const monthStart = `${todayISO().slice(0, 7)}-01`
  const monthEnd = monthEndISO(Number(todayISO().slice(0, 4)), Number(todayISO().slice(5, 7)))
  const monthlyInsurance = policies.reduce((s, p) => {
    const active = (!p.start_date || p.start_date <= monthEnd) && (!p.end_date || p.end_date >= monthStart)
    return s + (active ? (Number(p.monthly_premium) || 0) : 0)
  }, 0)
  const grossYield = propertyValue > 0 && monthlyRent > 0 ? (monthlyRent * 12 / propertyValue) * 100 : null

  // ── Return on the equity you actually put in (cash-on-cash + total) ──────────
  // The "real" annual result treats principal as savings, not cost: rent − interest
  // − upkeep. Interest is summed exactly over the next 12 months (grace-aware);
  // maintenance is a trailing average (cumulative ÷ years held) since it's lumpy.
  const annualRent = monthlyRent * 12
  const annualInterest = interestNext12Months(tracks, monthlyLoans)
  const yearsHeld = property?.purchase_date ? Math.max(1, daysBetween(property.purchase_date, todayISO()) / 365) : 0
  const annualMaintenance = yearsHeld > 0 ? maintenance / yearsHeld : 0
  const monthlyMaintenance = annualMaintenance / 12
  const netCashAnnual = annualRent - annualInterest - annualMaintenance - monthlyInsurance * 12
  /**
   * Return on THE MONEY THAT WENT IN — the owner's decision, 24.09.
   *
   * It used to be measured against current net equity (property value minus all debt),
   * which has a property nobody wants from a yield: as the mortgage is repaid the equity
   * grows, so the yield FALLS every month while nothing about the deal has changed. A
   * re-valuation of the flat moved it too, so "how hard is my money working" was answering
   * a question about the market rather than about the investment.
   *
   * The denominator is now `totalInvested` — equity plus every purchase cost, exactly the
   * figure the cash-flow card on this screen already calls "הון עצמי ועלויות רכישה". It is
   * fixed once the purchase is done, which is what makes the yield comparable to itself
   * over time and to any other investment.
   *
   * "תזרים בלבד" stays cash-on-cash (principal excluded, because it is not a cost);
   * "כולל בניית הון" adds back the principal repaid this year.
   */
  const canRoe = totalInvested > 0 && monthlyRent > 0
  const roeCash = canRoe ? (netCashAnnual / totalInvested) * 100 : null
  const roeTotal = canRoe ? ((netCashAnnual + annualPrincipal) / totalInvested) * 100 : null

  // Cumulative cash view: everything that went out (equity + costs + interest +
  // maintenance) vs. rent collected so far. Net is pure cash, ignoring property value.
  const totalOut = totalInvested + interestPaid + maintenance
  const cashNet = rentReceived - totalOut
  const hasCashflow = totalOut > 0 || rentReceived > 0

  /**
   * With no principal repaid this year, "תזרים בלבד" and "כולל בניית הון" are the same
   * number by construction — there is nothing to add back. Showing both is then two labels
   * for one figure, which is the shape of Omer's note 17 (three rows reading 2.5%). Under
   * the old denominator the gross yield collapsed into them as well; it no longer does, so
   * only the pair folds.
   */
  const noPrincipalYet = annualPrincipal <= 0

  const hasData = propertyValue > 0 || mortgageBalance > 0 || balloon > 0

  function closeEditor() {
    setEditing(false)
    refetchProp(); refetchMortgage(); refetchInv(); refetchLoans()
  }

  // Esc closes the full-screen editor overlay (mirrors the app Modal — UX-05).
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeEditor() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  return (
    <div className="page wlth">
      <div className="page-header wlth-header">
        <h1>הון</h1>
        <button className="wlth-edit-btn" onClick={() => setEditing(true)}>
          <PencilSimple size={16} /> ערוך מימון ועלויות
        </button>
      </div>

      {statsLoading ? <SkeletonList rows={3} /> : (loadError && !hasData) ? (
        // A failed first load (no cache → all zeros) must NOT read as "nothing defined
        // yet" — that invites the user to re-enter data they already have. Show a
        // retryable error instead (audit: silent-fetch cluster).
        <PageError message={loadError} onRetry={() => { refetchProp(); refetchMortgage(); refetchInv(); refetchLoans() }} />
      ) : !hasData ? (
        <EmptyState
          icon={<ClayIllustration variant="bank" />}
          title="עדיין לא הוגדרו נכס, משכנתא או הלוואות"
          hint="הוסיפו פרטי מימון ועלויות כדי לראות את ההון העצמי שלכם"
          actionLabel="ערוך מימון ועלויות"
          onAction={() => setEditing(true)}
        />
      ) : (
        <>
          {/* Composition first before the key — it is the only thing on this screen that is
              already true. After the key the screen keeps the order the owner knows, and the
              composition sits further down. */}
          {awaitingKey && (
            <DealStructure
              price={property?.purchase_price ?? propertyValue}
              tracks={tracks} loans={[...monthlyLoans, ...balloonLoans]} costs={costs}
              tax={planTax}
            />
          )}

          {propertyValue > 0 && !awaitingKey && (
            <OwnershipScore
              propertyValue={propertyValue}
              bankDebt={bankDebt}
              balloon={balloon}
              monthlyPrincipal={split.isCurrentMonth ? split.principal : 0}
            />
          )}

          {!awaitingKey && (
            <WealthAccelerator
              current={split}
              future5yPrincipal={future5y.principal}
              annualPrincipal={annualPrincipal}
              fromMonth={split.isCurrentMonth ? null : split.month}
              inGrace={inGrace}
              resumesMonth={accelResumes}
            />
          )}

          {monthlyRent > 0 && split.isCurrentMonth && (
            <MonthlyResult
              monthlyRent={monthlyRent}
              mortgageInterest={mortgageSplit.interest}
              loansInterest={loansSplit.interest}
              monthlyPrincipal={split.principal}
              monthlyMaintenance={monthlyMaintenance}
              monthlyInsurance={monthlyInsurance}
            />
          )}

          {hasCashflow && !awaitingKey && (
            <section className="wlth-card wlth-cashflow">
              <div className="wlth-card-head">
                <h2>הכנסות מול הוצאות</h2>
                <span className="wlth-card-note">מצטבר · כולל הון עצמי</span>
              </div>
              <div className="wlth-cf-rows">
                <div className="wlth-cf-row">
                  {/* "שהתקבל" asserted receipt. `rentReceivedToDate` counts what the LEASE
                      says is due since it started — the ledger here held 16,000 while this
                      line read 44,000 (NIGHT_RUN C2-C). Naming the source is the honest
                      minimum; whether the figure should instead come from the transactions
                      is the owner's call, not a rename. */}
                  <span><i className="wlth-cf-dot in" /> שכר דירה לפי החוזה</span>
                  <strong className="in">{fmt(rentReceived)}</strong>
                </div>
                <div className="wlth-cf-row">
                  <span><i className="wlth-cf-dot equity" /> הון עצמי ועלויות רכישה</span>
                  <strong>{fmt(totalInvested)}</strong>
                </div>
                {interestPaid > 0 && (
                  <div className="wlth-cf-row">
                    <span><i className="wlth-cf-dot out" /> ריבית ששולמה</span>
                    <strong>{fmt(interestPaid)}</strong>
                  </div>
                )}
                {maintenance > 0 && (
                  <button
                    type="button"
                    className="wlth-cf-row wlth-cf-row-link"
                    onClick={() => navigate('/finances', { state: { historyCategory: MAINTENANCE_CATEGORY } })}
                  >
                    <span><i className="wlth-cf-dot out" /> אחזקה ותיקונים</span>
                    <strong>{fmt(maintenance)} <CaretLeft size={13} weight="bold" /></strong>
                  </button>
                )}
              </div>
              <div className="wlth-cf-net">
                <span>{cashNet >= 0 ? 'נטו חיובי' : 'הושקע נטו (טרם הוחזר)'}</span>
                <strong className={cashNet >= 0 ? 'in' : 'out'}>{fmt(Math.abs(cashNet))}</strong>
              </div>
            </section>
          )}

          {/* Unique figures only — "הון שהושקע" (totalInvested) was dropped here because
              it already appears in the cash-flow card above as "הון עצמי ועלויות רכישה"
              (owner, 20.07). Gross yield + monthly rent aren't shown elsewhere. */}
          {!awaitingKey && (grossYield != null || monthlyRent > 0 || roeCash != null) && (
            <section className="wlth-card">
              <div className="wlth-card-head">
                <h2>תשואות</h2>
                <button type="button" className="wlth-yield-help" aria-expanded={yieldHelp}
                  aria-label="מה ההבדל בין התשואות" onClick={() => setYieldHelp(h => !h)}>
                  <Question size={16} weight="bold" />
                </button>
              </div>
              <div className="wlth-yields">
                {/* With nothing being repaid this year the two equity yields are one number
                    wearing two labels — there is no principal to add back. That is the
                    shape of Omer's note 17 (three rows reading 2.5%), so in that state the
                    card says it once. */}
                {noPrincipalYet
                  ? (roeCash != null && <div><span>על מה שהשקעת<br />תזרים</span><strong>{roeCash.toFixed(1)}%</strong></div>)
                  : (<>
                      {roeCash != null && <div><span>על מה שהשקעת<br />תזרים בלבד</span><strong>{roeCash.toFixed(1)}%</strong></div>}
                      {roeTotal != null && <div><span>על מה שהשקעת<br />כולל בניית הון</span><strong>{roeTotal.toFixed(1)}%</strong></div>}
                    </>)}
                {grossYield != null && <div><span>ברוטו<br />על שווי הנכס</span><strong>{grossYield.toFixed(1)}%</strong></div>}
                {monthlyRent > 0 && <div><span>שכר דירה<br />חודשי</span><strong>{fmt(monthlyRent)}</strong></div>}
              </div>
              {yieldHelp && (
                <div className="wlth-yield-help-body">
                  <p><b>ברוטו</b> — שכר הדירה השנתי חלקי שווי הנכס. לא מתחשב בריבית, בביטוח, באחזקה או בחוב.</p>
                  <p><b>על מה שהשקעת{noPrincipalYet ? '' : ' · תזרים בלבד'}</b> — מה שנשאר ביד בשנה (שכר דירה פחות ריבית, ביטוח ואחזקה), חלקי הכסף שיצא מהכיס.</p>
                  {!noPrincipalYet && (
                    <p><b>על מה שהשקעת · כולל בניית הון</b> — אותו דבר, ובתוספת החזר הקרן: הקרן היא חיסכון, לא הוצאה.</p>
                  )}
                  {noPrincipalYet && (
                    <p className="muted">השנה עוד לא נפרעת קרן (משכנתא שטרם נמשכה, או תקופת גרייס), ולכן אין מה להוסיף — "תזרים" ו"כולל בניית הון" יוצאים זהים ומוצגים פעם אחת.</p>
                  )}
                  <p className="muted">
                    "מה שהשקעת" = ההון העצמי ועלויות הרכישה, {fmt(totalInvested)}. סכום קבוע — ולכן התשואה ניתנת להשוואה לעצמה לאורך זמן ולכל השקעה אחרת.
                  </p>
                </div>
              )}
              {/* The standing footnote says the same thing the open (?) says at more length —
                  printing both puts the definition on screen twice. */}
              {!yieldHelp && roeCash != null && (
                <p className="wlth-yield-note">מדוד מול {fmt(totalInvested)} — ההון העצמי ועלויות הרכישה.</p>
              )}
            </section>
          )}

          <FinancingStructure
            tracks={tracks}
            summary={summary}
            monthlyLoans={monthlyLoans}
            balloonLoans={balloonLoans}
            onEdit={() => setEditing(true)}
          />
        </>
      )}

      {editing && createPortal(
        // Portal to <body> so the full-screen editor is a top-level sibling of the fixed
        // app top-bar (z-index 95) and reliably paints above it — not trapped in the page's
        // stacking context. Re-wrap in `.wlth` since wealth.css is scoped to it.
        <div className="wlth">
          <div className="wlth-editor" role="dialog" aria-modal="true" aria-label="עריכת מימון ועלויות">
            <div className="wlth-editor-head">
              <button onClick={closeEditor} aria-label="חזור"><CaretRight size={24} weight="bold" /></button>
              <h2>עריכת מימון ועלויות</h2>
            </div>
            <div className="wlth-editor-body">
              <h3 className="wlth-editor-section">משכנתא והלוואות</h3>
              <LiabilitiesV2 embedded />
              <h3 className="wlth-editor-section">הון עצמי ועלויות רכישה</h3>
              <InvestmentCosts />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
