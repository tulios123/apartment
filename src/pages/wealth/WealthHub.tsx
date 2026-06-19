import { useState } from 'react'
import { PencilSimple, X } from '@phosphor-icons/react'
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
import { SkeletonList } from '../../components/ui/Skeleton'
import './wealth.css'

const fmt = (v: number) => formatCurrency(v)

export default function WealthHub() {
  const [editing, setEditing] = useState(false)

  const { property, contracts, loading: loadingProp, refetch: refetchProp } = usePropertyData()
  const { tracks, summary, loading: loadingMortgage, refetch: refetchMortgage } = useMortgageData()
  const { totalInvested, loading: loadingInv, refetch: refetchInv } = useInvestmentData()
  const { monthlyLoans, balloonLoans, summary: loansSummary, loading: loadingLoans, refetch: refetchLoans } = useLoansData()

  const statsLoading = loadingProp || loadingMortgage || loadingInv || loadingLoans

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

  const hasData = propertyValue > 0 || mortgageBalance > 0 || balloon > 0

  function closeEditor() {
    setEditing(false)
    refetchProp(); refetchMortgage(); refetchInv(); refetchLoans()
  }

  return (
    <div className="page wlth">
      <div className="page-header wlth-header">
        <h1>הון</h1>
        <button className="wlth-edit-btn" onClick={() => setEditing(true)}>
          <PencilSimple size={16} /> ערוך מימון ועלויות
        </button>
      </div>

      {statsLoading ? <SkeletonList rows={3} /> : !hasData ? (
        <div className="wlth-empty">עדיין לא הוגדרו נכס, משכנתא או הלוואות. הוסף בעזרת כפתור העריכה.</div>
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
            hasBalloon={balloonLoans.length > 0}
          />

          <FinancingStructure
            tracks={tracks}
            summary={summary}
            monthlyLoans={monthlyLoans}
            balloonLoans={balloonLoans}
            onEdit={() => setEditing(true)}
          />

          {(grossYield != null || monthlyRent > 0 || totalInvested > 0) && (
            <section className="wlth-secondary">
              {grossYield != null && <div><span>תשואה ברוטו</span><strong>{grossYield.toFixed(1)}%</strong></div>}
              {monthlyRent > 0 && <div><span>שכ״ד חודשי</span><strong>{fmt(monthlyRent)}</strong></div>}
              {totalInvested > 0 && <div><span>הון שהושקע</span><strong>{fmt(totalInvested)}</strong></div>}
            </section>
          )}
        </>
      )}

      {editing && (
        <div className="wlth-editor" role="dialog" aria-label="עריכת מימון ועלויות">
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
