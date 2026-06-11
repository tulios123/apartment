import { useNavigate } from 'react-router-dom'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useMortgageData } from '../../hooks/useMortgageData'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { useInsurance } from '../../hooks/useInsurance'
import { formatCurrency } from '../../lib/format'

export default function Overview() {
  const navigate = useNavigate()
  const { property, contracts, loading: propLoading } = usePropertyData()
  const { summary, loading: mortLoading } = useMortgageData()
  const { totalInvested, loading: invLoading } = useInvestmentData()
  const { policies, loading: insLoading } = useInsurance()

  const loading = propLoading || mortLoading || invLoading || insLoading

  const activeContract = contracts.find(c => {
    const now = new Date()
    return new Date(c.start_date) <= now && new Date(c.end_date) >= now
  })

  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? null
  const monthlyRent = activeContract?.monthly_rent ?? null
  const annualRent = monthlyRent ? monthlyRent * 12 : null
  const grossYield = annualRent && totalInvested > 0
    ? (annualRent / totalInvested) * 100
    : null
  const totalInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)

  if (loading) return <div className="empty-state">טוען...</div>

  return (
    <div className="overview-grid">
      <button className="overview-card" onClick={() => navigate('/property/details')}>
        <div className="overview-card-label">שווי נכס</div>
        <div className="overview-card-value">
          {propertyValue != null ? formatCurrency(propertyValue) : <span className="text-muted">לא הוזן</span>}
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
        {totalInvested > 0 && (
          <div className="overview-card-sub">מתוך {formatCurrency(totalInvested)} שהושקעו</div>
        )}
      </button>
    </div>
  )
}
