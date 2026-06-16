import { useState } from 'react'
import { House, CheckCircle, ArrowsLeftRight, ArrowDownLeft, ArrowUpRight } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useMortgageData } from '../hooks/useMortgageData'
import { usePropertyData } from '../hooks/usePropertyData'
import { useInvestmentData } from '../hooks/useInvestmentData'
import { useInsurance } from '../hooks/useInsurance'
import { formatCurrency, formatDate } from '../lib/format'
import { gracePeriodPayment } from '../lib/mortgage'
import { activeContract as findActiveContract, monthlyVirtualEntries } from '../lib/projections'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../lib/constants'
import { Skeleton, SkeletonStats, SkeletonList } from '../components/ui/Skeleton'
import { EmptyState, PageError } from '../components/ui/EmptyState'

export default function Dashboard() {
  const navigate = useNavigate()
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
  const { policies, loading: loadingInsurance } = useInsurance()

  // Per-section loading — each region reveals as soon as its own data is ready,
  // instead of blocking the whole screen on the slowest hook.
  const summaryLoading = loadingProperty || loadingMortgage || loadingInvestment
  const flowLoading = loadingProperty || loadingMortgage || loadingInsurance || loadingStats
  const recentLoading = loadingStats || loadingProperty || loadingMortgage

  if (error) return <PageError message={error} />

  // ── Computations ──────────────────────────────────────────────────────────
  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const equity = propertyValue - mortgageBalance

  const now = new Date()
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const monthlyMortgage = summary.monthlyPayment || 0
  const monthlyInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)

  const hasGrace = tracks.some(t => (t.grace_months ?? 0) > 0)
  const gracePeriodPaymentAmount = gracePeriodPayment(tracks)
  const selectedMortgage = hasGrace ? gracePeriodPaymentAmount : monthlyMortgage

  // Owner-paid utilities with a specified amount
  const activeContractId = activeContract?.id
  const ownerUtilities = utilities.filter(u =>
    u.payer === 'owner' && u.amount != null && u.amount > 0 &&
    (!activeContractId || u.contract_id === activeContractId)
  )
  const monthlyOwnerUtilities = ownerUtilities.reduce((s, u) => s + (u.amount ?? 0), 0)

  const monthlyNet = monthlyRent - selectedMortgage - monthlyInsurance - monthlyOwnerUtilities
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

  // ── תנועות החודש הנוכחי — הכנסות/הוצאות נוספות מעבר לקבועים ──
  const monthPrefix = todayStr.slice(0, 7) // "YYYY-MM"
  const rentCatSet = new Set(RENT_CATEGORIES as readonly string[])
  const mortCatSet = new Set(MORTGAGE_CATEGORIES as readonly string[])

  const thisMonthTxs = recentTransactions.filter(t => t.date.startsWith(monthPrefix))
  const extraIncomeTxs = thisMonthTxs.filter(t => t.direction === 'income' && !rentCatSet.has(t.category))
  const extraExpenseTxs = thisMonthTxs.filter(t => t.direction === 'expense' && !mortCatSet.has(t.category))
  const extraIncome = extraIncomeTxs.reduce((s, t) => s + t.amount, 0)
  const extraExpense = extraExpenseTxs.reduce((s, t) => s + t.amount, 0)
  const adjustedNet = monthlyNet + extraIncome - extraExpense

  const realRecent = recentTransactions
    .filter(t => !(t.direction === 'income' && rentCatSet.has(t.category)))
    .filter(t => !(t.direction === 'expense' && mortCatSet.has(t.category)))
    .map(t => ({ id: t.id, date: t.date, category: t.category, direction: t.direction, amount: t.amount }))
  const virtualRecent = monthlyVirtualEntries(contracts, tracks, now.getFullYear())
    .map(v => ({ id: v.id, date: v.date, category: v.category, direction: v.direction, amount: v.amount }))
  const recentItems = [...realRecent, ...virtualRecent]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1>ראשי</h1>
      </div>

      {/* ── 1. Hero — equity + investment summary ────────────────────────── */}
      {summaryLoading ? (
        <div className="dash-hero dash-hero-skeleton">
          <Skeleton width="40%" height={14} />
          <Skeleton width="60%" height={32} />
          <Skeleton width="100%" height={12} radius={6} />
        </div>
      ) : !property ? (
        <EmptyState
          icon={<House size={40} />}
          title="עדיין לא הוגדר נכס"
          actionLabel="הגדרת נכס"
          onAction={() => navigate('/property/details')}
        />
      ) : (
        <div className="dash-hero" onClick={() => navigate('/property')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('/property')}>
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
        </div>
      )}

      {/* ── 2. תזרים החודש — one cash-flow card ───────────────────────────── */}
      <div className="dash-section-title-row">
        <div className="dash-section-title">תזרים החודש</div>
      </div>
      {flowLoading ? <SkeletonStats count={3} /> : (
      <div className="prop-card">
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
        <div className="inv-flow-row">
          <span className="inv-flow-sign negative">−</span>
          <span className="inv-flow-label">ביטוח</span>
          <span className="inv-flow-amount negative">
            {monthlyInsurance > 0 ? formatCurrency(monthlyInsurance) : <span className="text-muted">—</span>}
          </span>
        </div>
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
        {recentLoading ? (
          <SkeletonList rows={4} />
        ) : recentItems.length === 0 ? (
          <EmptyState
            icon={<ArrowsLeftRight size={40} />}
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

      {/* ── 6. Quick actions ─────────────────────────────────────────────── */}
      <div className="dashboard-quick-actions">
        <button className="btn-secondary" onClick={() => navigate('/finances', { state: { openForm: true } })}>+ תנועה</button>
        <button className="btn-secondary" onClick={() => navigate('/tasks')}>+ משימה</button>
        <button className="btn-secondary" onClick={() => navigate('/property')}>הנכס</button>
      </div>
    </div>
  )
}
