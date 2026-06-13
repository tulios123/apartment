import { House, CheckCircle, ArrowsLeftRight } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useMortgageData } from '../hooks/useMortgageData'
import { usePropertyData } from '../hooks/usePropertyData'
import { useInvestmentData } from '../hooks/useInvestmentData'
import { useInsurance } from '../hooks/useInsurance'
import { formatCurrency, formatDate } from '../lib/format'
import { activeContract as findActiveContract } from '../lib/projections'
import { SkeletonStats, SkeletonList } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'

export default function Dashboard() {
  const navigate = useNavigate()

  const {
    recentTransactions,
    openTasks,
    upcomingRenewals,
    loading: loadingStats,
    error,
  } = useDashboardStats()

  const { summary, loading: loadingMortgage } = useMortgageData()
  const { property, contracts, loading: loadingProperty } = usePropertyData()
  const { totalInvested, rentReceived, loading: loadingInvestment } = useInvestmentData()
  const { policies, loading: loadingInsurance } = useInsurance()

  const loading = loadingStats || loadingMortgage || loadingProperty || loadingInvestment || loadingInsurance

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="page-header"><h1>ראשי</h1></div>
        <SkeletonStats count={3} />
        <SkeletonList rows={5} />
      </div>
    )
  }

  if (error) return <div className="form-error">{error}</div>

  // ── Computations ──────────────────────────────────────────────────────────
  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const equity = propertyValue - mortgageBalance

  const now = new Date()
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const monthlyMortgage = summary.monthlyPayment || 0
  const monthlyInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)
  const monthlyNet = monthlyRent - monthlyMortgage - monthlyInsurance
  const grossYield =
    propertyValue > 0 && monthlyRent > 0 ? (monthlyRent * 12 / propertyValue) * 100 : null

  // Equity bar widths (%)
  const equityPct = propertyValue > 0 ? Math.max(0, Math.min(100, (equity / propertyValue) * 100)) : 0
  const debtPct = 100 - equityPct

  // ── "דורש תשומת לב" — merged list ──────────────────────────────────────
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

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1>ראשי</h1>
      </div>

      {/* ── 1. Hero — equity ──────────────────────────────────────────────── */}
      {!property ? (
        <EmptyState
          icon={<House size={40} />}
          title="עדיין לא הוגדר נכס"
          actionLabel="הגדרת נכס"
          onAction={() => navigate('/property/details')}
        />
      ) : (
        <div className="dash-hero" onClick={() => navigate('/property/overview')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('/property/overview')}>
          <div className="dash-hero-label">ההון שלי בנכס</div>
          <div className="dash-hero-value">{formatCurrency(equity)}</div>

          <div className="dash-equity-bar">
            <div
              className="dash-equity-bar-own"
              style={{ width: `${equityPct}%` }}
            />
            <div
              className="dash-equity-bar-debt"
              style={{ width: `${debtPct}%` }}
            />
          </div>

          <div className="dash-equity-legend">
            <span>שווי נכס {formatCurrency(propertyValue)}</span>
            <span>יתרת משכנתא {formatCurrency(mortgageBalance)}</span>
          </div>
        </div>
      )}

      {/* ── 2. תזרים החודש ────────────────────────────────────────────────── */}
      <div className="dash-section-title">תזרים החודש</div>
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">שכ״ד חודשי</div>
          <div className={`summary-amount ${monthlyRent > 0 ? 'positive' : ''}`}>
            {formatCurrency(monthlyRent)}
          </div>
          {!activeContract && (
            <div className="dash-card-note">אין חוזה פעיל</div>
          )}
        </div>
        <div className="summary-card">
          <div className="summary-label">הוצאות חודשיות</div>
          <div className="summary-amount negative">
            {formatCurrency(monthlyMortgage + monthlyInsurance)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">נטו חודשי</div>
          <div className={`summary-amount ${monthlyNet >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(monthlyNet)}
          </div>
        </div>
      </div>

      {/* ── 3. Small metrics ─────────────────────────────────────────────── */}
      <div className="dashboard-metrics">
        <div
          className="dashboard-metric-item"
          onClick={() => navigate('/property/investment')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && navigate('/property/investment')}
        >
          <div className="dashboard-metric-label">תשואה ברוטו</div>
          <div className="dashboard-metric-value">
            {grossYield != null ? `${grossYield.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="dashboard-metric-item">
          <div className="dashboard-metric-label">סה״כ הושקע</div>
          <div className="dashboard-metric-value">{formatCurrency(totalInvested)}</div>
        </div>
        <div className="dashboard-metric-item">
          <div className="dashboard-metric-label">שכ״ד שהתקבל</div>
          <div className="dashboard-metric-value">{formatCurrency(rentReceived)}</div>
        </div>
      </div>

      {/* ── 4. דורש תשומת לב ─────────────────────────────────────────────── */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>דורש תשומת לב</h2>
          <button className="btn-link" onClick={() => navigate('/tasks')}>הכל</button>
        </div>
        {attentionItems.length === 0 ? (
          <EmptyState icon={<CheckCircle size={40} />} title="אין משימות או חידושים קרובים" />
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

      {/* ── 5. תנועות אחרונות ─────────────────────────────────────────────── */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>תנועות אחרונות</h2>
          <button className="btn-link" onClick={() => navigate('/finances')}>הכל</button>
        </div>
        {recentTransactions.length === 0 ? (
          <EmptyState
            icon={<ArrowsLeftRight size={40} />}
            title="אין תנועות עדיין"
            actionLabel="הוסף תנועה"
            onAction={() => navigate('/finances')}
          />
        ) : (
          <ul className="dashboard-tx-list">
            {recentTransactions.slice(0, 5).map(tx => (
              <li key={tx.id} className="dashboard-tx-item" onClick={() => navigate('/finances')}>
                <span className="dashboard-tx-date">{formatDate(tx.date)}</span>
                <span className="dashboard-tx-cat">{tx.category}</span>
                <span className={`dashboard-tx-amount ${tx.direction === 'income' ? 'positive' : 'negative'}`}>
                  {tx.direction === 'income' ? '+' : '−'}{formatCurrency(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 6. Quick actions ─────────────────────────────────────────────── */}
      <div className="dashboard-quick-actions">
        <button className="btn-secondary" onClick={() => navigate('/finances')}>+ תנועה</button>
        <button className="btn-secondary" onClick={() => navigate('/tasks')}>+ משימה</button>
        <button className="btn-secondary" onClick={() => navigate('/property/overview')}>הנכס</button>
      </div>
    </div>
  )
}
