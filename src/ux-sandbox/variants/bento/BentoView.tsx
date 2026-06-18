import { useState } from 'react'
import './bento.css'
import {
  House, ChartLineUp, Bank, Warning, Plus, X,
  ArrowUpRight, ArrowDownLeft, CaretRight,
} from '@phosphor-icons/react'

const TX = [
  { id: 't1', dir: 'income', desc: 'שכר דירה — יוני', date: '1 ביוני 2026', amount: '₪6,800' },
  { id: 't2', dir: 'expense', desc: 'תיקון דוד שמש', date: '28 במאי 2026', amount: '₪1,240' },
  { id: 't3', dir: 'expense', desc: 'ביטוח מבנה', date: '24 במאי 2026', amount: '₪320' },
]

export default function BentoView() {
  const [trayOpen, setTrayOpen] = useState(false)

  return (
    <div className="bento-root">
      <aside className="bento-sidebar">
        <div className="bento-brand"><House size={20} weight="fill" /></div>
        <nav className="bento-nav">
          <button className="bento-nav-item is-active" aria-label="בית"><House size={20} weight="fill" /></button>
          <button className="bento-nav-item" aria-label="תזרים"><ChartLineUp size={20} /></button>
          <button className="bento-nav-item" aria-label="התחייבויות"><Bank size={20} /></button>
        </nav>
        <button className="bento-fab" onClick={() => setTrayOpen(o => !o)} aria-label="הוסף תנועה">
          <Plus size={20} weight="bold" />
        </button>

        {trayOpen && (
          <div className="bento-tray">
            <div className="bento-tray-head">
              <span>תנועה חדשה</span>
              <button onClick={() => setTrayOpen(false)} aria-label="סגור"><X size={14} /></button>
            </div>
            <input className="bento-tray-input" placeholder="₪ סכום" autoFocus />
            <input className="bento-tray-input" placeholder="תיאור" />
            <select className="bento-tray-input" defaultValue="">
              <option value="" disabled>קטגוריה</option>
              <option>שכר דירה</option><option>תחזוקה</option><option>ביטוח</option>
            </select>
            <button className="bento-tray-save" onClick={() => setTrayOpen(false)}>שמירה</button>
          </div>
        )}
      </aside>

      <main className="bento-main">
        <div className="bento-grid">
          {/* Hero lens — large block */}
          <section className="bento-card bento-hero">
            <div className="bento-card-tag">הון עצמי</div>
            <div className="bento-hero-figure">₪2,450,000</div>
            <div className="bento-hero-badge">▲ 4.2% מהרבעון הקודם</div>
            <div className="bento-hero-split">
              <div><span>שווי נכס</span><strong>₪3,200,000</strong></div>
              <div><span>התחייבויות</span><strong>₪750,000</strong></div>
            </div>
          </section>

          {/* Cashflow block */}
          <section className="bento-card bento-flow">
            <div className="bento-card-tag">תזרים חודשי</div>
            <div className="bento-flow-figure">₪8,400</div>
            <div className="bento-flow-bars">
              <div className="bento-flow-bar"><span style={{ height: '100%' }} className="in" /><label>הכנסה</label></div>
              <div className="bento-flow-bar"><span style={{ height: '30%' }} className="out" /><label>יציאה</label></div>
            </div>
          </section>

          {/* Tasks block with priority flag */}
          <section className="bento-card bento-tasks">
            <div className="bento-card-head"><span>דורש תשומת לב</span><CaretRight size={14} /></div>
            <div className="bento-task is-urgent">
              <span className="bento-task-icon"><Warning size={16} weight="fill" /></span>
              <div className="bento-task-body">
                <span className="bento-task-title">תשלום ארנונה רבעוני</span>
                <span className="bento-task-meta">יעד · 30 ביוני 2026</span>
              </div>
              <span className="bento-flag">באיחור</span>
            </div>
            <div className="bento-task">
              <span className="bento-task-icon"><House size={16} /></span>
              <div className="bento-task-body">
                <span className="bento-task-title">חידוש חוזה — משפ׳ כהן</span>
                <span className="bento-task-meta">מסתיים · 14 ספטמבר 2026</span>
              </div>
              <span className="bento-flag soft">88 ימים</span>
            </div>
          </section>

          {/* Transactions block */}
          <section className="bento-card bento-tx">
            <div className="bento-card-head"><span>תנועות אחרונות</span><CaretRight size={14} /></div>
            {TX.map(tx => (
              <div key={tx.id} className="bento-tx-row">
                <span className={`bento-tx-tile ${tx.dir}`}>
                  {tx.dir === 'income' ? <ArrowDownLeft size={15} weight="bold" /> : <ArrowUpRight size={15} weight="bold" />}
                </span>
                <div className="bento-tx-body">
                  <span className="bento-tx-desc">{tx.desc}</span>
                  <span className="bento-tx-date">{tx.date}</span>
                </div>
                <span className={`bento-tx-amount ${tx.dir}`}>{tx.dir === 'income' ? '+' : '−'}{tx.amount}</span>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  )
}
