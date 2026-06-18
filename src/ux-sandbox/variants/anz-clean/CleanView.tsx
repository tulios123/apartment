import { useState } from 'react'
import './clean.css'
import {
  House, ChartLineUp, Bank, Gear, Plus, X, Warning,
  ArrowUpRight, ArrowDownLeft, TrendUp,
} from '@phosphor-icons/react'

const TX = [
  { id: 't1', dir: 'income', desc: 'שכר דירה — יוני', date: '1 ביוני 2026', cat: 'שכירות', amount: '₪6,800' },
  { id: 't2', dir: 'expense', desc: 'תיקון דוד שמש', date: '28 במאי 2026', cat: 'תחזוקה', amount: '₪1,240' },
  { id: 't3', dir: 'expense', desc: 'ביטוח מבנה', date: '24 במאי 2026', cat: 'ביטוח', amount: '₪320' },
  { id: 't4', dir: 'income', desc: 'החזר ועד בית', date: '18 במאי 2026', cat: 'אחר', amount: '₪150' },
]

export default function CleanView() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="clean-root">
      <aside className="clean-rail">
        <div className="clean-logo">A+</div>
        <nav>
          <button className="clean-rail-item on" aria-label="בית"><House size={22} weight="fill" /></button>
          <button className="clean-rail-item" aria-label="תזרים"><ChartLineUp size={22} /></button>
          <button className="clean-rail-item" aria-label="התחייבויות"><Bank size={22} /></button>
          <button className="clean-rail-item" aria-label="הגדרות"><Gear size={22} /></button>
        </nav>
      </aside>

      <main className="clean-main">
        <header className="clean-topbar">
          <div>
            <h1 className="clean-title">שלום, איתי</h1>
            <p className="clean-subtitle">דירת מגורים · רחוב הברוש 14</p>
          </div>
          <button className="clean-add" onClick={() => setDrawerOpen(true)}>
            <Plus size={18} weight="bold" /> תנועה
          </button>
        </header>

        <div className="clean-grid">
          <section className="clean-card clean-equity">
            <span className="clean-card-label">הון עצמי</span>
            <div className="clean-bignum">₪2,450,000</div>
            <span className="clean-trend up"><TrendUp size={15} weight="bold" /> 4.2% רבעוני</span>
            <div className="clean-split">
              <div><span>שווי נכס</span><strong>₪3,200,000</strong></div>
              <div><span>התחייבויות</span><strong>₪750,000</strong></div>
            </div>
          </section>

          <section className="clean-card clean-cash">
            <span className="clean-card-label">תזרים חודשי</span>
            <div className="clean-bignum teal">₪8,400</div>
            <span className="clean-trend up"><TrendUp size={15} weight="bold" /> 2.1%</span>
            <div className="clean-meter"><span style={{ width: '70%' }} /></div>
            <span className="clean-meter-cap">70% מההכנסה נשמרת</span>
          </section>

          <section className="clean-card clean-tasks">
            <span className="clean-card-label">דורש תשומת לב</span>
            <div className="clean-task urgent">
              <Warning size={18} weight="fill" />
              <div><span className="clean-task-t">תשלום ארנונה רבעוני</span><span className="clean-task-m">יעד · 30 ביוני 2026</span></div>
              <span className="clean-pill danger">באיחור</span>
            </div>
            <div className="clean-task">
              <House size={18} />
              <div><span className="clean-task-t">חידוש חוזה — משפ׳ כהן</span><span className="clean-task-m">מסתיים · 14 ספטמבר 2026</span></div>
              <span className="clean-pill">88 ימים</span>
            </div>
          </section>

          <section className="clean-card clean-feed">
            <span className="clean-card-label">תנועות אחרונות</span>
            {TX.map(tx => (
              <div key={tx.id} className="clean-tx">
                <span className={`clean-tx-glyph ${tx.dir}`}>
                  {tx.dir === 'income' ? <ArrowDownLeft size={15} weight="bold" /> : <ArrowUpRight size={15} weight="bold" />}
                </span>
                <div className="clean-tx-body">
                  <span className="clean-tx-desc">{tx.desc}</span>
                  <span className="clean-tx-meta">{tx.date} · {tx.cat}</span>
                </div>
                <span className={`clean-tx-amount ${tx.dir}`}>{tx.dir === 'income' ? '+' : '−'}{tx.amount}</span>
              </div>
            ))}
          </section>
        </div>
      </main>

      {/* Utility drawer from right edge (RTL → enters from left visually) */}
      <div className={`clean-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`clean-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="clean-drawer-head">
          <h2>תנועה חדשה</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={18} /></button>
        </div>
        <label className="clean-field"><span>סכום ₪</span><input type="number" placeholder="0.00" autoFocus={drawerOpen} /></label>
        <label className="clean-field"><span>תיאור</span><input type="text" placeholder="לדוגמה: תיקון דוד שמש" /></label>
        <label className="clean-field"><span>קטגוריה</span>
          <select defaultValue=""><option value="" disabled>בחר</option><option>שכירות</option><option>תחזוקה</option><option>ביטוח</option></select>
        </label>
        <button className="clean-drawer-save" onClick={() => setDrawerOpen(false)}>שמירת תנועה</button>
      </aside>
    </div>
  )
}
