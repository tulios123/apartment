import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { formatCurrency, formatDate } from '../lib/format'
import type { Task } from '../types'
import { SkeletonStats, SkeletonList } from '../components/ui/Skeleton'


function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false
  return task.due_date < new Date().toISOString().slice(0, 10)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { totalIncome, totalExpense, balance, recentTransactions, openTasks, upcomingRenewals, loading, error } = useDashboardStats()

  if (loading) return (
    <div className="page dashboard-page">
      <SkeletonStats count={3} />
      <SkeletonList rows={4} />
    </div>
  )
  if (error) return <div className="form-error">{error}</div>

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1>ראשי</h1>
      </div>

      {/* Summary cards — all-time totals */}
      <div className="summary-cards">
        <div className="summary-card income">
          <div className="summary-label">הכנסות סה״כ</div>
          <div className="summary-amount">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="summary-card expense">
          <div className="summary-label">הוצאות סה״כ</div>
          <div className="summary-amount">{formatCurrency(totalExpense)}</div>
        </div>
        <div className="summary-card balance">
          <div className="summary-label">מאזן</div>
          <div className={`summary-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(balance)}
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        {/* Pending tasks */}
        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2>פעולות ממתינות</h2>
            <button className="btn-link" onClick={() => navigate('/tasks')}>הכל</button>
          </div>
          {openTasks.length === 0 ? (
            <div className="empty-state small">אין פעולות ממתינות</div>
          ) : (
            <ul className="dashboard-task-list">
              {openTasks.map(task => (
                <li
                  key={task.id}
                  className={`dashboard-task-item${isOverdue(task) ? ' overdue' : ''}`}
                  onClick={() => navigate('/tasks')}
                >
                  <span className="dashboard-task-title">{task.title}</span>
                  {task.due_date && (
                    <span className="dashboard-task-due">{formatDate(task.due_date)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent transactions */}
        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2>עסקאות אחרונות</h2>
            <button className="btn-link" onClick={() => navigate('/finances')}>הכל</button>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="empty-state small">אין עסקאות</div>
          ) : (
            <ul className="dashboard-tx-list">
              {recentTransactions.map(tx => (
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

        {/* Upcoming renewals */}
        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2>חידושים קרובים</h2>
            <button className="btn-link" onClick={() => navigate('/property')}>נכס</button>
          </div>
          {upcomingRenewals.length === 0 ? (
            <div className="empty-state small">אין חידושים קרובים</div>
          ) : (
            <ul className="dashboard-task-list">
              {upcomingRenewals.map(({ contract, daysLeft }) => (
                <li
                  key={contract.id}
                  className={`dashboard-task-item${daysLeft <= 30 ? ' overdue' : ''}`}
                  onClick={() => navigate('/property')}
                >
                  <span className="dashboard-task-title">{contract.company_name}</span>
                  <span className="dashboard-task-due">
                    {formatDate(contract.end_date)} · {daysLeft} ימים
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
