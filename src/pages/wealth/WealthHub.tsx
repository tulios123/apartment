import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PencilSimple, X, CaretLeft } from '@phosphor-icons/react'
import InvestmentCosts from '../property/InvestmentCosts'
import LiabilitiesV2 from '../liabilities/LiabilitiesV2'
import OwnershipScore from './OwnershipScore'
import WealthAccelerator from './WealthAccelerator'
import FinancingStructure from './FinancingStructure'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useMortgageData } from '../../hooks/useMortgageData'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { useLoansData } from '../../hooks/useLoansData'
import { currentSplit, futureSplit, principalNext12Months } from '../../lib/equity'
import { formatCurrency } from '../../lib/format'
import { activeContract as findActiveContract } from '../../lib/projections'
import { MAINTENANCE_CATEGORY } from '../../lib/constants'
import { SkeletonList } from '../../components/ui/Skeleton'
import { EmptyState, PageError } from '../../components/ui/EmptyState'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
import './wealth.css'

const fmt = (v: number) => formatCurrency(v)

export default function WealthHub() {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  const { property, contracts, loading: loadingProp, error: errProp, refetch: refetchProp } = usePropertyData()
  const { tracks, summary, loading: loadingMortgage, error: errMortgage, refetch: refetchMortgage } = useMortgageData()
  const { totalInvested, rentReceived, interestPaid, maintenance, loading: loadingInv, error: errInv, refetch: refetchInv } = useInvestmentData()
  const { monthlyLoans, balloonLoans, summary: loansSummary, loading: loadingLoans, error: errLoans, refetch: refetchLoans } = useLoansData()

  const statsLoading = loadingProp || loadingMortgage || loadingInv || loadingLoans
  const loadError = errProp || errMortgage || errInv || errLoans

  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const bankDebt = mortgageBalance + (loansSummary.monthlyBalance || 0)
  const balloon = loansSummary.balloonOutstanding || 0

  const split = currentSplit(tracks, monthlyLoans)
  const future5y = futureSplit(tracks, monthlyLoans, 60)
  const annualPrincipal = principalNext12Months(tracks, monthlyLoans)

  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const grossYield = propertyValue > 0 && monthlyRent > 0 ? (monthlyRent * 12 / propertyValue) * 100 : null

  // Cumulative cash view: everything that went out (equity + costs + interest +
  // maintenance) vs. rent collected so far. Net is pure cash, ignoring property value.
  const totalOut = totalInvested + interestPaid + maintenance
  const cashNet = rentReceived - totalOut
  const hasCashflow = totalOut > 0 || rentReceived > 0

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
          {propertyValue > 0 && (
            <OwnershipScore
              propertyValue={propertyValue}
              bankDebt={bankDebt}
              balloon={balloon}
              monthlyPrincipal={split.principal}
            />
          )}

          <WealthAccelerator
            current={split}
            future5yPrincipal={future5y.principal}
            annualPrincipal={annualPrincipal}
          />

          <FinancingStructure
            tracks={tracks}
            summary={summary}
            monthlyLoans={monthlyLoans}
            balloonLoans={balloonLoans}
            onEdit={() => setEditing(true)}
          />

          {hasCashflow && (
            <section className="wlth-card wlth-cashflow">
              <div className="wlth-card-head">
                <h2>הכנסות מול הוצאות</h2>
                <span className="wlth-card-note">מצטבר · כולל הון עצמי</span>
              </div>
              <div className="wlth-cf-rows">
                <div className="wlth-cf-row">
                  <span><i className="wlth-cf-dot in" /> שכר דירה שהתקבל</span>
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

          {(grossYield != null || monthlyRent > 0 || totalInvested > 0) && (
            <section className="wlth-secondary">
              {grossYield != null && <div><span>תשואה ברוטו</span><strong>{grossYield.toFixed(1)}%</strong></div>}
              {monthlyRent > 0 && <div><span>שכר דירה חודשי</span><strong>{fmt(monthlyRent)}</strong></div>}
              {totalInvested > 0 && <div><span>הון שהושקע</span><strong>{fmt(totalInvested)}</strong></div>}
            </section>
          )}
        </>
      )}

      {editing && (
        <div className="wlth-editor" role="dialog" aria-modal="true" aria-label="עריכת מימון ועלויות">
          <div className="wlth-editor-head">
            <h2>עריכת מימון ועלויות</h2>
            <button onClick={closeEditor} aria-label="סגור"><X size={20} /></button>
          </div>
          <div className="wlth-editor-body">
            <h3 className="wlth-editor-section">משכנתא והלוואות</h3>
            <LiabilitiesV2 embedded />
            <h3 className="wlth-editor-section">הון עצמי ועלויות רכישה</h3>
            <InvestmentCosts />
          </div>
        </div>
      )}
    </div>
  )
}
