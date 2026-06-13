import { useNavigate } from 'react-router-dom'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useMortgageData } from '../../hooks/useMortgageData'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { useInsurance } from '../../hooks/useInsurance'
import { formatCurrency } from '../../lib/format'
import { insurancePaidToDate as calcInsurancePaidToDate, activeContract as findActiveContract } from '../../lib/projections'
import { SkeletonCard } from '../../components/ui/Skeleton'

export default function Overview() {
  const navigate = useNavigate()
  const { property, contracts, loading: propLoading } = usePropertyData()
  const { summary, loading: mortLoading } = useMortgageData()
  const { totalInvested, rentReceived, interestPaid, maintenance, loading: invLoading } = useInvestmentData()
  const { policies, loading: insLoading } = useInsurance()

  const loading = propLoading || mortLoading || invLoading || insLoading

  const activeContract = findActiveContract(contracts)

  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const monthlyRent = activeContract?.monthly_rent ?? null
  const annualRent = monthlyRent ? monthlyRent * 12 : null
  const grossYield = propertyValue > 0 && annualRent
    ? (annualRent / propertyValue) * 100
    : null
  const totalInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)
  const insurancePaidToDate = calcInsurancePaidToDate(policies)
  const totalSpent = totalInvested + interestPaid + insurancePaidToDate + maintenance

  if (loading) return (
    <div className="overview-grid">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )

  return (
    <div className="overview-grid">
      <button className="overview-card" onClick={() => navigate('/property/details')}>
        <div className="overview-card-label">שווי נכס</div>
        <div className="overview-card-value">
          {propertyValue > 0 ? formatCurrency(propertyValue) : <span className="text-muted">לא הוזן</span>}
        </div>
        {property?.address && <div className="overview-card-sub">{property.address}</div>}
      </button>

      <button className="overview-card" onClick={() => navigate('/property/mortgage')}>
        <div className="overview-card-label">יתרת משכנתא</div>
        <div className="overview-card-value">
          {summary.currentBalance > 0 ? formatCurrency(summary.currentBalance) : <span className="text-muted">אין משכנתא</span>}
        </div>
        {summary.monthlyPayment > 0 && (
          <div className="overview-card-sub">{formatCurrency(summary.monthlyPayment)} / חודש</div>
        )}
      </button>

      <button className="overview-card" onClick={() => navigate('/property/rental')}>
        <div className="overview-card-label">שכ״ד חודשי</div>
        <div className="overview-card-value">
          {monthlyRent != null ? formatCurrency(monthlyRent) : <span className="text-muted">אין חוזה פעיל</span>}
        </div>
        {activeContract && (
          <div className="overview-card-sub">
            {activeContract.company_name}
          </div>
        )}
      </button>

      <button className="overview-card" onClick={() => navigate('/property/insurance')}>
        <div className="overview-card-label">ביטוח חודשי</div>
        <div className="overview-card-value">
          {totalInsurance > 0 ? formatCurrency(totalInsurance) : <span className="text-muted">אין פוליסות</span>}
        </div>
        {policies.length > 0 && (
          <div className="overview-card-sub">{policies.length} פוליסות</div>
        )}
      </button>

      <button className="overview-card" onClick={() => navigate('/property/investment')}>
        <div className="overview-card-label">תשואה שנתית ברוטו</div>
        <div className="overview-card-value">
          {grossYield != null ? `${grossYield.toFixed(1)}%` : <span className="text-muted">לא מחושב</span>}
        </div>
        {propertyValue > 0 && (
          <div className="overview-card-sub">מתוך שווי הנכס {formatCurrency(propertyValue)}</div>
        )}
        {totalInvested > 0 && annualRent != null && (
          <div className="overview-card-sub">תשואה על ההון: {(annualRent / totalInvested * 100).toFixed(1)}%</div>
        )}
      </button>

      <button className="overview-card" onClick={() => navigate('/property/investment')}>
        <div className="overview-card-label">הכנסות / הוצאות</div>
        <div className="overview-card-value overview-card-split">
          <span className="positive">{rentReceived > 0 ? formatCurrency(rentReceived) : <span className="text-muted">—</span>}</span>
          <span className="overview-card-slash">/</span>
          <span className="negative">{totalSpent > 0 ? formatCurrency(totalSpent) : <span className="text-muted">—</span>}</span>
        </div>
        <div className="overview-card-sub">שכירות מצטברת / השקעה, ריבית, ביטוח, תחזוקה</div>
      </button>
    </div>
  )
}
