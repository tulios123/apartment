import './sandbox-tokens.css'
import './sandbox-layout.css'
import {
  House, ChartPie, SquaresFour, Gear,
  TrendUp, ArrowDownLeft, ArrowUpRight,
} from '@phosphor-icons/react'

const NAV_ITEMS = [
  { icon: House, label: 'Overview', active: true },
  { icon: ChartPie, label: 'Insights', active: false },
  { icon: SquaresFour, label: 'Modules', active: false },
  { icon: Gear, label: 'Settings', active: false },
]

const ACTIVITY = [
  { id: 't1', direction: 'income', desc: 'שכר דירה — יוני', date: '1 ביוני 2026', amount: '₪6,800' },
  { id: 't2', direction: 'expense', desc: 'תיקון דוד שמש', date: '28 במאי 2026', amount: '₪1,240' },
  { id: 't3', direction: 'expense', desc: 'ביטוח מבנה', date: '24 במאי 2026', amount: '₪320' },
  { id: 't4', direction: 'income', desc: 'החזר ועד בית', date: '18 במאי 2026', amount: '₪150' },
] as const

export default function SandboxContainer() {
  return (
    <div className="sandbox-root">
      <main className="sb-layout-grid">
        <aside className="sb-nav-dock">
          {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
            <div key={label} className={`sb-nav-item${active ? ' is-active' : ''}`}>
              <Icon size={22} weight={active ? 'fill' : 'regular'} />
              <span>{label}</span>
            </div>
          ))}
        </aside>

        <section className="sb-content-area">
          <header className="sb-header-group">
            <h1 className="sb-title">Workspace Overview</h1>
            <p className="sb-subtitle">דירת מגורים · רחוב הברוש 14 · עודכן לפני רגע</p>
          </header>

          {/* ── Hero Lens: a single grand element, two fluid lenses ───────── */}
          <div className="sb-hero-lens">
            <div className="sb-lens-toggle">
              <button className="is-active">הון (Equity)</button>
              <button>תזרים (Cash Flow)</button>
            </div>

            <div className="sb-hero-readout">
              <span className="sb-hero-label">ההון שלי בנכס</span>
              <div className="sb-hero-figure-row">
                <span className="sb-hero-figure">₪2,450,000</span>
                <span className="sb-growth-badge is-up">
                  <TrendUp size={14} weight="bold" />
                  4.2%
                </span>
              </div>
            </div>

            <div className="sb-hero-subgrid">
              <div className="sb-hero-stat">
                <span className="sb-hero-stat-label">שווי נכס</span>
                <span className="sb-hero-stat-value">₪3,200,000</span>
              </div>
              <div className="sb-hero-stat is-debt">
                <span className="sb-hero-stat-label">סך התחייבויות</span>
                <span className="sb-hero-stat-value">₪750,000</span>
              </div>
            </div>
          </div>

          {/* ── Two-column sub-grid: attention vs. activity ───────────────── */}
          <div className="sb-dashboard-grid">
            <div className="sb-attention-stack">
              <h3>דורש תשומת לב</h3>

              <div className="sb-attention-item">
                <div className="sb-attention-body">
                  <span className="sb-attention-badge">משימה פתוחה</span>
                  <span className="sb-attention-title">תשלום ארנונה רבעוני</span>
                  <span className="sb-attention-meta">יעד · 30 ביוני 2026</span>
                </div>
                <span className="sb-attention-flag">באיחור</span>
              </div>

              <div className="sb-attention-item">
                <div className="sb-attention-body">
                  <span className="sb-attention-badge">חידוש חוזה</span>
                  <span className="sb-attention-title">שכירות — משפ׳ כהן</span>
                  <span className="sb-attention-meta">מסתיים · 14 ספטמבר 2026</span>
                </div>
                <span className="sb-attention-countdown">88 ימים</span>
              </div>
            </div>

            <div className="sb-activity-feed">
              <h3>תנועות אחרונות</h3>

              {ACTIVITY.map(tx => (
                <div key={tx.id} className="sb-transaction-row">
                  <span className={`sb-tx-tile ${tx.direction}`} aria-hidden="true">
                    {tx.direction === 'income'
                      ? <ArrowDownLeft size={16} weight="bold" />
                      : <ArrowUpRight size={16} weight="bold" />}
                  </span>
                  <div className="sb-tx-body">
                    <span className="sb-tx-desc">{tx.desc}</span>
                    <span className="sb-tx-date">{tx.date}</span>
                  </div>
                  <span className={`sb-tx-amount ${tx.direction}`}>
                    {tx.direction === 'income' ? '+' : '−'}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
