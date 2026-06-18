import { useState } from 'react'
import './hybrid.css'
import {
  House, ChartLineUp, Bank, Gear, Plus, X, Warning, Drop, Lightning, Wrench, ShoppingCart,
  ArrowUpRight, ArrowDownLeft, TrendUp,
} from '@phosphor-icons/react'

type Lens = 'equity' | 'cashflow'

const SPEND = [
  { id: 's1', icon: House, label: 'משכנתא', amount: '₪4,200', tint: 'blue' },
  { id: 's2', icon: Wrench, label: 'תחזוקה', amount: '₪1,240', tint: 'violet' },
  { id: 's3', icon: Lightning, label: 'חשמל', amount: '₪320', tint: 'amber' },
  { id: 's4', icon: Drop, label: 'מים', amount: '₪180', tint: 'teal' },
  { id: 's5', icon: ShoppingCart, label: 'ועד בית', amount: '₪150', tint: 'green' },
]

const TX = [
  { id: 't1', dir: 'income', desc: 'שכר דירה — יוני', date: '1 ביוני 2026', cat: 'שכירות', amount: '₪6,800' },
  { id: 't2', dir: 'expense', desc: 'תיקון דוד שמש', date: '28 במאי 2026', cat: 'תחזוקה', amount: '₪1,240' },
  { id: 't3', dir: 'expense', desc: 'ביטוח מבנה', date: '24 במאי 2026', cat: 'ביטוח', amount: '₪320' },
  { id: 't4', dir: 'income', desc: 'החזר ועד בית', date: '18 במאי 2026', cat: 'אחר', amount: '₪150' },
]

export default function HybridView() {
  const [lens, setLens] = useState<Lens>('equity')
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="hyb-root">
      <aside className="hyb-rail">
        <div className="hyb-logo">A+</div>
        <nav>
          <button className="hyb-rail-item on" aria-label="בית"><House size={22} weight="fill" /></button>
          <button className="hyb-rail-item" aria-label="תזרים"><ChartLineUp size={22} /></button>
          <button className="hyb-rail-item" aria-label="התחייבויות"><Bank size={22} /></button>
          <button className="hyb-rail-item" aria-label="הגדרות"><Gear size={22} /></button>
        </nav>
      </aside>

      <main className="hyb-main">
        <header className="hyb-topbar">
          <div>
            <h1 className="hyb-title">שלום, איתי</h1>
            <p className="hyb-subtitle">דירת מגורים · רחוב הברוש 14</p>
          </div>
        </header>

        <div className="hyb-grid">
          {/* Hero — Fluid's sliding lens inside Clean's wide gradient card */}
          <section className="hyb-card hyb-hero">
            <div className="hyb-toggle">
              <button className={lens === 'equity' ? 'on' : ''} onClick={() => setLens('equity')}>הון</button>
              <button className={lens === 'cashflow' ? 'on' : ''} onClick={() => setLens('cashflow')}>תזרים</button>
            </div>
            <div className="hyb-viewport">
              <div className="hyb-track" data-lens={lens}>
                <div className="hyb-pane">
                  <span className="hyb-pane-label">הון עצמי בנכס</span>
                  <div className="hyb-pane-figure">₪2,450,000</div>
                  <span className="hyb-pane-trend"><TrendUp size={15} weight="bold" /> 4.2% רבעוני</span>
                  <div className="hyb-pane-split">
                    <div><span>שווי נכס</span><strong>₪3,200,000</strong></div>
                    <div><span>התחייבויות</span><strong>₪750,000</strong></div>
                  </div>
                </div>
                <div className="hyb-pane">
                  <span className="hyb-pane-label">תזרים חודשי נטו</span>
                  <div className="hyb-pane-figure">₪8,400</div>
                  <span className="hyb-pane-trend"><TrendUp size={15} weight="bold" /> 2.1% מהחודש שעבר</span>
                  <div className="hyb-pane-split">
                    <div><span>הכנסות</span><strong>₪12,000</strong></div>
                    <div><span>יציאות</span><strong>₪3,600</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Spending pills card — Fluid's colorful breakdown in a white bento block */}
          <section className="hyb-card hyb-spend">
            <span className="hyb-card-label">פירוט הוצאות קבועות</span>
            <div className="hyb-pills">
              {SPEND.map(({ icon: Icon, ...s }) => (
                <button key={s.id} className={`hyb-pill ${s.tint}`}>
                  <span className="hyb-pill-icon"><Icon size={20} weight="fill" /></span>
                  <span className="hyb-pill-label">{s.label}</span>
                  <span className="hyb-pill-amount">{s.amount}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Tasks */}
          <section className="hyb-card hyb-tasks">
            <span className="hyb-card-label">דורש תשומת לב</span>
            <div className="hyb-task urgent">
              <Warning size={18} weight="fill" />
              <div><span className="hyb-task-t">תשלום ארנונה רבעוני</span><span className="hyb-task-m">יעד · 30 ביוני 2026</span></div>
              <span className="hyb-pill-flag danger">באיחור</span>
            </div>
            <div className="hyb-task">
              <House size={18} />
              <div><span className="hyb-task-t">חידוש חוזה — משפ׳ כהן</span><span className="hyb-task-m">מסתיים · 14 ספטמבר 2026</span></div>
              <span className="hyb-pill-flag">88 ימים</span>
            </div>
          </section>

          {/* Transactions feed */}
          <section className="hyb-card hyb-feed">
            <span className="hyb-card-label">תנועות אחרונות</span>
            {TX.map(tx => (
              <div key={tx.id} className="hyb-tx">
                <span className={`hyb-tx-glyph ${tx.dir}`}>
                  {tx.dir === 'income' ? <ArrowDownLeft size={15} weight="bold" /> : <ArrowUpRight size={15} weight="bold" />}
                </span>
                <div className="hyb-tx-body">
                  <span className="hyb-tx-desc">{tx.desc}</span>
                  <span className="hyb-tx-meta">{tx.date} · {tx.cat}</span>
                </div>
                <span className={`hyb-tx-amount ${tx.dir}`}>{tx.dir === 'income' ? '+' : '−'}{tx.amount}</span>
              </div>
            ))}
          </section>
        </div>
      </main>

      {/* Fluid's round FAB triggering Clean's utility drawer */}
      <button className="hyb-fab" onClick={() => setDrawerOpen(true)} aria-label="הוסף תנועה">
        <Plus size={26} weight="bold" />
      </button>

      <div className={`hyb-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`hyb-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="hyb-drawer-head">
          <h2>תנועה חדשה</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={18} /></button>
        </div>
        <label className="hyb-field"><span>סכום ₪</span><input type="number" placeholder="0.00" autoFocus={drawerOpen} /></label>
        <label className="hyb-field"><span>תיאור</span><input type="text" placeholder="לדוגמה: תיקון דוד שמש" /></label>
        <label className="hyb-field"><span>קטגוריה</span>
          <select defaultValue=""><option value="" disabled>בחר</option><option>שכירות</option><option>תחזוקה</option><option>ביטוח</option></select>
        </label>
        <button className="hyb-drawer-save" onClick={() => setDrawerOpen(false)}>שמירת תנועה</button>
      </aside>
    </div>
  )
}
