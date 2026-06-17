import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { House, FileText, ShieldCheck, Coins, CaretDown } from '@phosphor-icons/react'
import Details from './Details'
import Rental from './Rental'
import Insurance from './Insurance'
import InvestmentCosts from './InvestmentCosts'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useMortgageData } from '../../hooks/useMortgageData'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { useInsurance } from '../../hooks/useInsurance'
import { formatCurrency } from '../../lib/format'
import { activeContract as findActiveContract } from '../../lib/projections'

const SECTIONS = [
  { id: 'details', label: 'נכס', Icon: House, Comp: Details },
  { id: 'rental', label: 'שכירות', Icon: FileText, Comp: Rental },
  { id: 'insurance', label: 'ביטוח', Icon: ShieldCheck, Comp: Insurance },
  { id: 'costs', label: 'עלויות השקעה', Icon: Coins, Comp: InvestmentCosts },
] as const

// Legacy deep-link aliases → section ids (so old /property/* links don't 404)
const ALIASES: Record<string, string> = {
  overview: 'details',
  investment: 'costs',
}

function resolveSection(raw: string | undefined): string {
  if (!raw) return 'details'
  const id = ALIASES[raw] ?? raw
  return SECTIONS.some(s => s.id === id) ? id : 'details'
}

export default function PropertyHub() {
  const { section } = useParams()
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => resolveSection(section))

  const { property, contracts, loading: loadingProp } = usePropertyData()
  const { summary, loading: loadingMortgage } = useMortgageData()
  const { totalInvested, loading: loadingInv } = useInvestmentData()
  const { policies, loading: loadingIns } = useInsurance()

  const statsLoading = loadingProp || loadingMortgage || loadingInv || loadingIns

  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const equity = propertyValue - mortgageBalance
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const monthlyInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)
  const grossYield =
    propertyValue > 0 && monthlyRent > 0 ? (monthlyRent * 12 / propertyValue) * 100 : null

  // Keep the open panel in sync when navigated via a deep link / external nav
  useEffect(() => {
    if (section) setOpen(resolveSection(section))
  }, [section])

  function toggle(id: string) {
    if (open === id) {
      setOpen('')
      navigate('/property', { replace: true })
    } else {
      setOpen(id)
      navigate(`/property/${id}`, { replace: true })
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>הנכס</h1>
      </div>

      {/* ── Quick-stats 2×2 grid (ANZ goal-cards style) ────────────────── */}
      {!statsLoading && property && (
        <div className="prop-stats-grid">
          <div className="prop-stat-card" onClick={() => navigate('/property/details')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
            <div className="prop-stat-label">שווי נכס</div>
            <div className="prop-stat-value">{formatCurrency(propertyValue)}</div>
            <div className="prop-stat-sub">הון עצמי {formatCurrency(equity)}</div>
          </div>
          <div className="prop-stat-card" onClick={() => navigate('/property/mortgage')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
            <div className="prop-stat-label">יתרת משכנתא</div>
            <div className="prop-stat-value">{formatCurrency(mortgageBalance)}</div>
            {summary.monthlyPayment > 0 && (
              <div className="prop-stat-sub">תשלום חודשי {formatCurrency(summary.monthlyPayment)}</div>
            )}
          </div>
          <div className="prop-stat-card" onClick={() => navigate('/property/rental')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
            <div className="prop-stat-label">תשואה ברוטו</div>
            <div className="prop-stat-value">{grossYield != null ? `${grossYield.toFixed(1)}%` : '—'}</div>
            {monthlyRent > 0 && (
              <div className="prop-stat-sub">שכ״ד {formatCurrency(monthlyRent)}/חודש</div>
            )}
          </div>
          <div className="prop-stat-card" onClick={() => navigate('/property/costs')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
            <div className="prop-stat-label">הושקע</div>
            <div className="prop-stat-value">{totalInvested > 0 ? formatCurrency(totalInvested) : '—'}</div>
            {monthlyInsurance > 0 && (
              <div className="prop-stat-sub">ביטוח {formatCurrency(monthlyInsurance)}/חודש</div>
            )}
          </div>
        </div>
      )}

      <div className="prop-accordion">
        {SECTIONS.map(({ id, label, Icon, Comp }) => {
          const isOpen = open === id
          return (
            <div key={id} className={`prop-accordion-item${isOpen ? ' open' : ''}`}>
              <button
                className="prop-accordion-header"
                onClick={() => toggle(id)}
                aria-expanded={isOpen}
              >
                <span className="prop-accordion-title">
                  <Icon size={20} weight="duotone" />
                  {label}
                </span>
                <CaretDown size={18} className="prop-accordion-chevron" />
              </button>
              {isOpen && (
                <div className="prop-accordion-panel">
                  <Comp />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
