import { useState } from 'react'
import './sandbox-tokens.css'
import './sandbox-layout.css'
import {
  House, ChartPie, SquaresFour, Gear,
  TrendUp, ArrowDownLeft, ArrowUpRight,
} from '@phosphor-icons/react'

type Lens = 'equity' | 'cashflow'

const LENS: Record<Lens, {
  label: string
  figure: string
  growth: string
  primary: { label: string; value: string }
  secondary: { label: string; value: string }
}> = {
  equity: {
    label: 'ההון שלי בנכס',
    figure: '₪2,450,000',
    growth: '4.2%',
    primary: { label: 'שווי נכס', value: '₪3,200,000' },
    secondary: { label: 'סך התחייבויות', value: '₪750,000' },
  },
  cashflow: {
    label: 'תזרים חודשי נטו',
    figure: '₪8,400',
    growth: '2.1%',
    primary: { label: 'הכנסות שכירות', value: '₪12,000' },
    secondary: { label: 'יציאות ומשכנתא', value: '₪3,600' },
  },
}

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
  const [activeLens, setActiveLens] = useState<Lens>('equity')
  const [isActionPanelOpen, setIsActionPanelOpen] = useState(false)
  const lens = LENS[activeLens]

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

          <button
            className="sb-btn-quick-add"
            onClick={() => setIsActionPanelOpen(open => !open)}
          >
            + תנועה
          </button>
        </aside>

        <section className="sb-content-area">
          <header className="sb-header-group">
            <h1 className="sb-title">Workspace Overview</h1>
            <p className="sb-subtitle">דירת מגורים · רחוב הברוש 14 · עודכן לפני רגע</p>
          </header>

          {/* ── Hero Lens: a single grand element, two fluid lenses ───────── */}
          <div className="sb-hero-lens">
            <div className="sb-lens-toggle">
              <button
                className={activeLens === 'equity' ? 'is-active' : ''}
                onClick={() => setActiveLens('equity')}
              >הון (Equity)</button>
              <button
                className={activeLens === 'cashflow' ? 'is-active' : ''}
                onClick={() => setActiveLens('cashflow')}
              >תזרים (Cash Flow)</button>
            </div>

            <div key={activeLens} className="sb-lens-content-wrapper">
              <div className="sb-hero-readout">
                <span className="sb-hero-label">{lens.label}</span>
                <div className="sb-hero-figure-row">
                  <span className="sb-hero-figure">{lens.figure}</span>
                  <span className="sb-growth-badge is-up">
                    <TrendUp size={14} weight="bold" />
                    {lens.growth}
                  </span>
                </div>
              </div>

              <div className="sb-hero-subgrid">
                <div className="sb-hero-stat">
                  <span className="sb-hero-stat-label">{lens.primary.label}</span>
                  <span className="sb-hero-stat-value">{lens.primary.value}</span>
                </div>
                <div className="sb-hero-stat is-debt">
                  <span className="sb-hero-stat-label">{lens.secondary.label}</span>
                  <span className="sb-hero-stat-value">{lens.secondary.value}</span>
                </div>
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

      {isActionPanelOpen && (
        <div className="sb-floating-action-panel">
          <h4>רישום תנועה חדשה</h4>

          <div className="sb-form-group">
            <label htmlFor="sb-amount">סכום ₪</label>
            <input id="sb-amount" type="number" inputMode="decimal" placeholder="0.00" autoFocus />
          </div>

          <div className="sb-form-group">
            <label htmlFor="sb-desc">תיאור</label>
            <input id="sb-desc" type="text" placeholder="לדוגמה: תיקון דוד שמש" />
          </div>

          <div className="sb-form-group">
            <label htmlFor="sb-category">קטגוריה</label>
            <select id="sb-category" defaultValue="">
              <option value="" disabled>בחר קטגוריה</option>
              <option value="rent">שכר דירה</option>
              <option value="maintenance">תחזוקה</option>
              <option value="insurance">ביטוח</option>
              <option value="utilities">חשבונות</option>
              <option value="other">אחר</option>
            </select>
          </div>

          <div className="sb-panel-actions">
            <button onClick={() => setIsActionPanelOpen(false)}>ביטול</button>
            <button className="sb-btn-save" onClick={() => setIsActionPanelOpen(false)}>שמירה</button>
          </div>
        </div>
      )}
    </div>
  )
}
