import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { House, FileText, ShieldCheck, Coins } from '@phosphor-icons/react'
import Details from './Details'
import Rental from './Rental'
import Insurance from './Insurance'
import InvestmentCosts from './InvestmentCosts'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useMortgageData } from '../../hooks/useMortgageData'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { useLoansData } from '../../hooks/useLoansData'
import { useInsurance } from '../../hooks/useInsurance'
import { formatCurrency } from '../../lib/format'
import { activeContract as findActiveContract } from '../../lib/projections'
import { SkeletonList } from '../../components/ui/Skeleton'
import './property-v2.css'

const TABS = [
  { id: 'details', label: 'נכס', Icon: House, Comp: Details },
  { id: 'rental', label: 'שכירות', Icon: FileText, Comp: Rental },
  { id: 'insurance', label: 'ביטוח', Icon: ShieldCheck, Comp: Insurance },
  { id: 'costs', label: 'עלויות', Icon: Coins, Comp: InvestmentCosts },
] as const

// Legacy deep-link aliases → tab ids (so old /property/* links don't 404)
const ALIASES: Record<string, string> = { overview: 'details', investment: 'costs' }

function resolveSection(raw: string | undefined): string {
  if (!raw) return 'details'
  const id = ALIASES[raw] ?? raw
  return TABS.some(t => t.id === id) ? id : 'details'
}

const fmt = (v: number) => formatCurrency(v)

export default function PropertyV2() {
  const { section } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => resolveSection(section))

  const { property, contracts, loading: loadingProp } = usePropertyData()
  const { summary, loading: loadingMortgage } = useMortgageData()
  const { totalInvested, loading: loadingInv } = useInvestmentData()
  const { summary: loansSummary, loading: loadingLoans } = useLoansData()
  const { policies, loading: loadingIns } = useInsurance()

  const statsLoading = loadingProp || loadingMortgage || loadingInv || loadingLoans || loadingIns

  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const totalDebt = mortgageBalance + (loansSummary.monthlyBalance || 0) + (loansSummary.balloonOutstanding || 0)
  const equity = propertyValue - totalDebt
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const monthlyInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)
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
    navigate(`/property/${id}`, { replace: true })
  }

  const Active = TABS.find(t => t.id === tab)?.Comp ?? Details

  return (
    <div className="page prov">
      <div className="page-header"><h1>הנכס</h1></div>

      {statsLoading ? <SkeletonList rows={3} /> : (
        <>
          {propertyValue > 0 && (
            <div className="prov-hero">
              <div className="prov-hero-top">
                <div>
                  <div className="prov-hero-label">שווי הנכס</div>
                  <div className="prov-hero-value">{fmt(propertyValue)}</div>
                </div>
                {property?.address && <div className="prov-hero-addr">{property.address}</div>}
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
                {monthlyInsurance > 0 && (
                  <div><span>ביטוח</span><strong>{fmt(monthlyInsurance)}/חו׳</strong></div>
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
