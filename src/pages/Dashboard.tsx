import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Coins } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useMortgageData } from '../hooks/useMortgageData'
import { usePropertyData } from '../hooks/usePropertyData'
import { useInvestmentData } from '../hooks/useInvestmentData'
import { useLoansData } from '../hooks/useLoansData'
import { useInsurance } from '../hooks/useInsurance'
import { formatCurrency, formatDate } from '../lib/format'
import { gracePeriodPayment } from '../lib/mortgage'
import { activeContract as findActiveContract, monthlyVirtualEntries } from '../lib/projections'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../lib/constants'
import { Skeleton, SkeletonList } from '../components/ui/Skeleton'
import { EmptyState, PageError } from '../components/ui/EmptyState'
import { ClayIllustration } from '../components/ui/ClayIllustration'
import { DonutChart } from '../components/ui/DonutChart'
import { BarChart } from '../components/ui/BarChart'

const DONUT_PALETTE = [
  'var(--accent)',
  'var(--accent-coral)',
  'var(--accent-teal)',
  'var(--danger)',
  'var(--brand-navy)',
  'var(--success)',
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [dashView, setDashView] = useState<'equity' | 'cashflow'>('equity')

  const {
    recentTransactions,
    openTasks,
    upcomingRenewals,
    loading: loadingStats,
    error,
  } = useDashboardStats()

  const { summary, tracks, loading: loadingMortgage } = useMortgageData()
  const { property, contracts, utilities, loading: loadingProperty } = usePropertyData()
  const { totalInvested, rentReceived, loading: loadingInvestment } = useInvestmentData()
  const { summary: loansSummary, loading: loadingLoans } = useLoansData()
  const { policies, loading: loadingInsurance } = useInsurance()

  const summaryLoading = loadingProperty || loadingMortgage || loadingInvestment || loadingLoans
  const flowLoading = loadingProperty || loadingMortgage || loadingInsurance || loadingStats
  const recentLoading = loadingStats || loadingProperty || loadingMortgage

  if (error) return <PageError message={error} />

  // ── Computations ──────────────────────────────────────────────────────────
  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const loanBalance = loansSummary.monthlyBalance || 0
  const balloonBalance = loansSummary.balloonOutstanding || 0
  const totalDebt = mortgageBalance + loanBalance + balloonBalance
  const equity = propertyValue - totalDebt

  const now = new Date()
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const monthlyMortgage = summary.monthlyPayment || 0
  const monthlyLoan = loansSummary.monthlyPayment || 0
  const monthlyInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)

  const hasGrace = tracks.some(t => (t.grace_months ?? 0) > 0)
  const gracePeriodPaymentAmount = gracePeriodPayment(tracks)
  const selectedMortgage = hasGrace ? gracePeriodPaymentAmount : monthlyMortgage

  const activeContractId = activeContract?.id
  const ownerUtilities = utilities.filter(u =>
    u.payer === 'owner' && u.amount != null && u.amount > 0 &&
    (!activeContractId || u.contract_id === activeContractId)
  )
  const monthlyOwnerUtilities = ownerUtilities.reduce((s, u) => s + (u.amount ?? 0), 0)

  const monthlyNet = monthlyRent - selectedMortgage - monthlyLoan - monthlyInsurance - monthlyOwnerUtilities
  const grossYield =
    propertyValue > 0 && monthlyRent > 0 ? (monthlyRent * 12 / propertyValue) * 100 : null

  // Equity bar — each liability gets its own segment (and colour).
  const barPct = (v: number) => propertyValue > 0 ? Math.max(0, Math.min(100, (v / propertyValue) * 100)) : 0
  const equityPct = barPct(equity)
  const mortgagePct = barPct(mortgageBalance)
  const loanPct = barPct(loanBalance)
  const balloonPct = barPct(balloonBalance)

  // ── Attention items ──────────────────────────────────────────────────────
  type AttentionItem = {
    key: string
    title: string
    date: string | null
    daysLeft?: number
    kind: 'task' | 'renewal'
    overdue: boolean
    onClick: () => void
  }

  const todayStr = now.toISOString().slice(0, 10)
  const monthPrefix = todayStr.slice(0, 7)
  const rentCatSet = new Set(RENT_CATEGORIES as readonly string[])
  const mortCatSet = new Set(MORTGAGE_CATEGORIES as readonly string[])

  const taskItems: AttentionItem[] = openTasks.map(task => ({
    key: `task-${task.id}`,
    title: task.title,
    date: task.due_date ?? null,
    kind: 'task',
    overdue: !!task.due_date && task.due_date < todayStr,
    onClick: () => navigate('/tasks'),
  }))

  const renewalItems: AttentionItem[] = upcomingRenewals.map(({ contract, daysLeft }) => ({
    key: `renewal-${contract.id}`,
    title: `${contract.company_name} — חידוש`,
    date: contract.end_date,
    daysLeft,
    kind: 'renewal',
    overdue: daysLeft <= 30,
    onClick: () => navigate('/property/rental'),
  }))

  const attentionItems = [...taskItems, ...renewalItems]
    .sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
    .slice(0, 5)

  // ── Cash-flow extra transactions this month ──────────────────────────────
  const thisMonthTxs = recentTransactions.filter(t => t.date.startsWith(monthPrefix))
  const extraIncomeTxs = thisMonthTxs.filter(t => t.direction === 'income' && !rentCatSet.has(t.category))
  const extraExpenseTxs = thisMonthTxs.filter(t => t.direction === 'expense' && !mortCatSet.has(t.category))
  const extraIncome = extraIncomeTxs.reduce((s, t) => s + t.amount, 0)
  const extraExpense = extraExpenseTxs.reduce((s, t) => s + t.amount, 0)
  const adjustedNet = monthlyNet + extraIncome - extraExpense

  // ── Recent transactions ──────────────────────────────────────────────────
  const realRecent = recentTransactions
    .filter(t => !(t.direction === 'income' && rentCatSet.has(t.category)))
    .filter(t => !(t.direction === 'expense' && mortCatSet.has(t.category)))
    .map(t => ({ id: t.id, date: t.date, category: t.category, direction: t.direction, amount: t.amount }))
  const virtualRecent = monthlyVirtualEntries(contracts, tracks, now.getFullYear())
    .map(v => ({ id: v.id, date: v.date, category: v.category, direction: v.direction, amount: v.amount }))
  const recentItems = [...realRecent, ...virtualRecent]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  // ── Expense breakdown for mini donut (תזרים view) ────────────────────────
  const dashExpenseBreakdown = (() => {
    const map = new Map<string, number>()
    if (selectedMortgage > 0) map.set('משכנתא', selectedMortgage)
    if (monthlyLoan > 0) map.set('הלוואה', monthlyLoan)
    if (monthlyInsurance > 0) map.set('ביטוח', monthlyInsurance)
    if (monthlyOwnerUtilities > 0) map.set('חשבונות', monthlyOwnerUtilities)
    extraExpenseTxs.forEach(t => {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    })
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .map((d, i) => ({ ...d, color: DONUT_PALETTE[i % DONUT_PALETTE.length] }))
  })()

  const dashTotalExpense = selectedMortgage + monthlyLoan + monthlyInsurance + monthlyOwnerUtilities + extraExpense
  const dashTotalIncome = monthlyRent + extraIncome

  return (
    <div className="page dashboard-page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1>ראשי</h1>
        <button
          onClick={() => { localStorage.removeItem('ux_v2'); window.location.reload() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', font: 'inherit', fontSize: 13, fontWeight: 600, padding: '4px 0' }}
        >
          ✨ חזרה לעיצוב החדש
        </button>
      </div>

      {/* ── View toggle (הון / תזרים) ─────────────────────────────────────── */}
      {property && !summaryLoading && (
        <div className="dash-view-toggle">
          <div className="toggle-group">
            <button
              className={`toggle-btn${dashView === 'equity' ? ' active' : ''}`}
              onClick={() => setDashView('equity')}
            >הון</button>
            <button
              className={`toggle-btn${dashView === 'cashflow' ? ' active' : ''}`}
              onClick={() => setDashView('cashflow')}
            >תזרים</button>
          </div>
        </div>
      )}

      {/* ── 1. Hero card ─────────────────────────────────────────────────── */}
      {summaryLoading ? (
        <div className="dash-hero dash-hero-skeleton">
          <Skeleton width="40%" height={14} />
          <Skeleton width="60%" height={32} />
          <Skeleton width="100%" height={12} radius={6} />
        </div>
      ) : !property ? (
        <EmptyState
          icon={<ClayIllustration variant="house" />}
          title="עדיין לא הוגדר נכס"
          actionLabel="הגדרת נכס"
          onAction={() => navigate('/property/details')}
        />
      ) : (
        <div className="dash-hero">

          {dashView === 'equity' ? (
            <>
              <div className="dash-hero-label">ההון שלי בנכס</div>
              <div className="dash-hero-value">{formatCurrency(equity)}</div>

              <div className="dash-equity-bar">
                <div className="dash-equity-bar-own" style={{ width: `${equityPct}%` }} />
                {mortgageBalance > 0 && <div className="dash-equity-bar-debt" style={{ width: `${mortgagePct}%` }} />}
                {loanBalance > 0 && <div className="dash-equity-bar-loan" style={{ width: `${loanPct}%` }} />}
                {balloonBalance > 0 && <div className="dash-equity-bar-balloon" style={{ width: `${balloonPct}%` }} />}
              </div>
              <div className="dash-equity-legend">
                <span className="dash-legend-item"><i className="dash-legend-dot own" />שווי נכס {formatCurrency(propertyValue)}</span>
                {mortgageBalance > 0 && (
                  <span className="dash-legend-item"><i className="dash-legend-dot debt" />משכנתא {formatCurrency(mortgageBalance)}</span>
                )}
                {loanBalance > 0 && (
                  <span className="dash-legend-item"><i className="dash-legend-dot loan" />הלוואות {formatCurrency(loanBalance)}</span>
                )}
                {balloonBalance > 0 && (
                  <span className="dash-legend-item"><i className="dash-legend-dot balloon" />בלון {formatCurrency(balloonBalance)}</span>
                )}
              </div>
              {(grossYield != null || totalInvested > 0 || rentReceived > 0) && (
                <div className="dash-hero-metrics">
                  {grossYield != null && (
                    <div className="dash-hero-metric"><span>תשואה ברוטו</span><strong>{grossYield.toFixed(1)}%</strong></div>
                  )}
                  {totalInvested > 0 && (
                    <div className="dash-hero-metric"><span>הושקע</span><strong>{formatCurrency(totalInvested)}</strong></div>
                  )}
                  {rentReceived > 0 && (
                    <div className="dash-hero-metric"><span>שנגבה</span><strong>{formatCurrency(rentReceived)}</strong></div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="dash-hero-label">תזרים החודש</div>
              <div
                className="dash-hero-value"
                style={{ color: adjustedNet >= 0 ? 'var(--success)' : 'var(--danger)' }}
              >
                {formatCurrency(adjustedNet)}
              </div>

              {/* Two mini-chart cards */}
              {!flowLoading && (
                <div className="dash-mini-cards">
                  <div className="dash-mini-card">
                    <div className="dash-mini-card-label">הוצאות</div>
                    <div className="dash-mini-card-value">{formatCurrency(dashTotalExpense)}</div>
                    <DonutChart
                      data={dashExpenseBreakdown}
                      size={110}
                      thickness={18}
                      formatValue={formatCurrency}
                      showLegend={false}
                    />
                  </div>
                  <div className="dash-mini-card">
                    <div className="dash-mini-card-label">כניסות / יציאות</div>
                    <div className="dash-mini-card-value">{formatCurrency(dashTotalIncome)}</div>
                    <BarChart
                      data={[
                        { label: 'הכנסה', value: dashTotalIncome, color: 'var(--success)' },
                        { label: 'הוצאה', value: dashTotalExpense, color: 'var(--danger)' },
                      ]}
                      height={90}
                      formatValue={formatCurrency}
                    />
                  </div>
                </div>
              )}

              {/* Cashflow detail rows */}
              <div className="dash-cashflow-rows">
                <div className="inv-flow-row">
                  <span className="inv-flow-sign positive">+</span>
                  <span className="inv-flow-label">שכ״ד</span>
                  <span className="inv-flow-amount positive">
                    {monthlyRent > 0 ? formatCurrency(monthlyRent) : <span className="text-muted">אין חוזה פעיל</span>}
                  </span>
                </div>
                <div className="inv-flow-row">
                  <span className="inv-flow-sign negative">−</span>
                  <span className="inv-flow-label">משכנתא</span>
                  <span className="inv-flow-amount negative">
                    {selectedMortgage > 0 ? formatCurrency(selectedMortgage) : <span className="text-muted">—</span>}
                  </span>
                </div>
                {monthlyLoan > 0 && (
                  <div className="inv-flow-row">
                    <span className="inv-flow-sign negative">−</span>
                    <span className="inv-flow-label">הלוואה</span>
                    <span className="inv-flow-amount negative">{formatCurrency(monthlyLoan)}</span>
                  </div>
                )}
                {monthlyInsurance > 0 && (
                  <div className="inv-flow-row">
                    <span className="inv-flow-sign negative">−</span>
                    <span className="inv-flow-label">ביטוח</span>
                    <span className="inv-flow-amount negative">{formatCurrency(monthlyInsurance)}</span>
                  </div>
                )}
                {monthlyOwnerUtilities > 0 && (
                  <div className="inv-flow-row">
                    <span className="inv-flow-sign negative">−</span>
                    <span className="inv-flow-label">חשבונות</span>
                    <span className="inv-flow-amount negative">{formatCurrency(monthlyOwnerUtilities)}</span>
                  </div>
                )}
                {extraIncomeTxs.map(t => (
                  <div key={t.id} className="inv-flow-row">
                    <span className="inv-flow-sign positive">+</span>
                    <span className="inv-flow-label">{t.category}</span>
                    <span className="inv-flow-amount positive">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
                {extraExpenseTxs.map(t => (
                  <div key={t.id} className="inv-flow-row">
                    <span className="inv-flow-sign negative">−</span>
                    <span className="inv-flow-label">{t.category}</span>
                    <span className="inv-flow-amount negative">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
                <div className="inv-flow-divider" />
                <div className="inv-flow-row inv-flow-total">
                  <span className="inv-flow-sign">=</span>
                  <span className="inv-flow-label">נטו חודשי</span>
                  <span className={`inv-flow-amount ${adjustedNet >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(adjustedNet)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 2. Upcoming expenses row (ANZ-style) ─────────────────────────── */}
      {!summaryLoading && property && dashView === 'equity' && (
        <div
          className="dash-upcoming-row"
          onClick={() => setDashView('cashflow')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setDashView('cashflow')}
          aria-label="עבור לתזרים"
        >
          <div className="dash-upcoming-icon">
            <Coins size={22} weight="duotone" color="var(--accent)" />
          </div>
          <div className="dash-upcoming-info">
            <div className="dash-upcoming-title">הוצאות קבועות חודשיות</div>
            <div className="dash-upcoming-subtitle">משכנתא, ביטוח ועוד</div>
          </div>
          <div className="dash-upcoming-amount negative">
            {formatCurrency(selectedMortgage + monthlyLoan + monthlyInsurance + monthlyOwnerUtilities)}
          </div>
        </div>
      )}

      {/* ── 3. דורש תשומת לב ─────────────────────────────────────────────── */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>דורש תשומת לב</h2>
          <button className="btn-link" onClick={() => navigate('/tasks')}>הכל</button>
        </div>
        {loadingStats ? (
          <SkeletonList rows={3} />
        ) : attentionItems.length === 0 ? (
          <EmptyState icon={<ClayIllustration variant="check" />} title="אין משימות או חידושים קרובים" />
        ) : (
          <ul className="dashboard-task-list">
            {attentionItems.map(item => (
              <li
                key={item.key}
                className={`dashboard-task-item${item.overdue ? ' overdue' : ''}`}
                onClick={item.onClick}
              >
                <span className="dashboard-task-title">
                  {item.kind === 'renewal' && (
                    <span className="dash-attention-badge renewal">חידוש</span>
                  )}
                  {item.title}
                </span>
                <span className="dashboard-task-due">
                  {item.date ? formatDate(item.date) : ''}
                  {item.daysLeft !== undefined && ` · ${item.daysLeft} ימים`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 4. תנועות אחרונות ─────────────────────────────────────────────── */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>תנועות אחרונות</h2>
          <button className="btn-link" onClick={() => navigate('/finances')}>הכל</button>
        </div>
        {recentLoading ? (
          <SkeletonList rows={4} />
        ) : recentItems.length === 0 ? (
          <EmptyState
            icon={<ClayIllustration variant="exchange" />}
            title="אין תנועות עדיין"
            actionLabel="הוסף תנועה"
            onAction={() => navigate('/finances')}
          />
        ) : (
          <ul className="dashboard-tx-list">
            {recentItems.map(tx => (
              <li key={tx.id} className="dashboard-tx-item" onClick={() => navigate('/finances')}>
                <span className={`tx-tile ${tx.direction}`} aria-hidden="true">
                  {tx.direction === 'income'
                    ? <ArrowDownLeft size={17} weight="bold" />
                    : <ArrowUpRight size={17} weight="bold" />}
                </span>
                <span className="dashboard-tx-cat">
                  <span className="tx-cat-name">{tx.category}</span>
                  <span className="tx-cat-date">{formatDate(tx.date)}</span>
                </span>
                <span className={`dashboard-tx-amount ${tx.direction === 'income' ? 'positive' : 'negative'}`}>
                  {tx.direction === 'income' ? '+' : '−'}{formatCurrency(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 5. Quick actions ─────────────────────────────────────────────── */}
      <div className="dashboard-quick-actions">
        <button className="btn-secondary" onClick={() => navigate('/finances', { state: { openForm: true } })}>+ תנועה</button>
        <button className="btn-secondary" onClick={() => navigate('/tasks')}>+ משימה</button>
        <button className="btn-secondary" onClick={() => navigate('/property')}>הנכס</button>
      </div>
    </div>
  )
}
