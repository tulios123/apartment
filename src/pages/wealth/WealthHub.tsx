import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChartLineUp, Bank } from '@phosphor-icons/react'
import InvestmentCosts from '../property/InvestmentCosts'
import LiabilitiesV2 from '../liabilities/LiabilitiesV2'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useMortgageData } from '../../hooks/useMortgageData'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { useLoansData } from '../../hooks/useLoansData'
import { formatCurrency } from '../../lib/format'
import { activeContract as findActiveContract } from '../../lib/projections'
import { SkeletonList } from '../../components/ui/Skeleton'
import '../property/property-v2.css'

const LiabilitiesPanel = () => <LiabilitiesV2 embedded />

const TABS = [
  { id: 'overview', label: 'סקירה', Icon: ChartLineUp, Comp: InvestmentCosts },
  { id: 'liabilities', label: 'משכנתא והלוואות', Icon: Bank, Comp: LiabilitiesPanel },
] as const

// Legacy deep-link aliases → tab ids
const ALIASES: Record<string, string> = { costs: 'overview', investment: 'overview', mortgage: 'liabilities' }

function resolveSection(raw: string | undefined): string {
  if (!raw) return 'overview'
  const id = ALIASES[raw] ?? raw
  return TABS.some(t => t.id === id) ? id : 'overview'
}

const fmt = (v: number) => formatCurrency(v)

export default function WealthHub() {
  const { section } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => resolveSection(section))

  const { property, contracts, loading: loadingProp } = usePropertyData()
  const { summary, loading: loadingMortgage } = useMortgageData()
  const { totalInvested, loading: loadingInv } = useInvestmentData()
  const { summary: loansSummary, loading: loadingLoans } = useLoansData()

  const statsLoading = loadingProp || loadingMortgage || loadingInv || loadingLoans

  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const totalDebt = mortgageBalance + (loansSummary.monthlyBalance || 0) + (loansSummary.balloonOutstanding || 0)
  const equity = propertyValue - totalDebt
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const grossYield =
    propertyValue > 0 && monthlyRent > 0 ? (monthlyRent * 12 / propertyValue) * 100 : null

  const equityPct = propertyValue > 0 ? Math.max(0, Math.min(100, (equity / propertyValue) * 100)) : 0
  const debtPct = propertyValue > 0 ? Math.max(0, Math.min(100, (totalDebt / propertyValue) * 100)) : 0

  // Keep the active tab in sync when navigated via a deep link / external nav
  useEffect(() => {
    if (section) setTab(resolveSection(section))
  }, [section])

  function selectTab(id: string) {
    setTab(id)
    navigate(`/wealth/${id}`, { replace: true })
  }

  const Active = TABS.find(t => t.id === tab)?.Comp ?? InvestmentCosts

  return (
    <div className="page prov">
      <div className="page-header"><h1>הון</h1></div>

      {statsLoading ? <SkeletonList rows={3} /> : (
        <>
          {propertyValue > 0 && (
            <div className="prov-hero">
              <div className="prov-hero-top">
                <div>
                  <div className="prov-hero-label">הון עצמי</div>
                  <div className="prov-hero-value">{fmt(equity)}</div>
                </div>
                <div className="prov-hero-addr">שווי {fmt(propertyValue)}</div>
              </div>

              {totalDebt > 0 && (
                <>
                  <div className="prov-comp-bar">
                    <div className="equity" style={{ width: `${equityPct}%` }} />
                    <div className="debt" style={{ width: `${debtPct}%` }} />
                  </div>
                  <div className="prov-comp-legend">
                    <span><i className="prov-dot" style={{ background: 'var(--accent-teal)' }} /> הון עצמי {fmt(equity)}</span>
                    <span><i className="prov-dot" style={{ background: '#5aa0ec' }} /> חוב {fmt(totalDebt)}</span>
                  </div>
                </>
              )}

              <div className="prov-hero-foot">
                {grossYield != null && (
                  <div><span>תשואה ברוטו</span><strong>{grossYield.toFixed(1)}%</strong></div>
                )}
                {monthlyRent > 0 && (
                  <div><span>שכ״ד חודשי</span><strong>{fmt(monthlyRent)}</strong></div>
                )}
                {totalInvested > 0 && (
                  <div><span>הושקע</span><strong>{fmt(totalInvested)}</strong></div>
                )}
                {totalDebt > 0 && (
                  <div><span>חוב כולל</span><strong>{fmt(totalDebt)}</strong></div>
                )}
              </div>
            </div>
          )}

          <nav className="prov-tabs">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`prov-tab${tab === id ? ' on' : ''}`}
                onClick={() => selectTab(id)}
              >
                <Icon size={18} weight={tab === id ? 'fill' : 'regular'} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="prov-panel">
            <Active />
          </div>
        </>
      )}
    </div>
  )
}
