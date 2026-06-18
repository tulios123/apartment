import { useState } from 'react'
import './editorial.css'
import { ArrowUpRight, ArrowDownLeft, Plus, X } from '@phosphor-icons/react'

const TX = [
  { id: 't1', dir: 'income', desc: 'שכר דירה — יוני', date: '01.06', amount: '₪6,800' },
  { id: 't2', dir: 'expense', desc: 'תיקון דוד שמש', date: '28.05', amount: '₪1,240' },
  { id: 't3', dir: 'expense', desc: 'ביטוח מבנה', date: '24.05', amount: '₪320' },
  { id: 't4', dir: 'income', desc: 'החזר ועד בית', date: '18.05', amount: '₪150' },
]

const TASKS = [
  { id: 'a1', num: '01', title: 'תשלום ארנונה רבעוני', meta: '30 ביוני 2026', flag: 'באיחור' },
  { id: 'a2', num: '02', title: 'חידוש חוזה — משפ׳ כהן', meta: '14 ספטמבר 2026', flag: '88 ימים' },
]

export default function EditorialView() {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="edit-root">
      <div className="edit-canvas">
        <header className="edit-masthead">
          <div className="edit-mast-left">
            <span className="edit-kicker">תיק נדל״ן · 2026</span>
            <h1 className="edit-mast-title">הברוש 14</h1>
          </div>
          <button className="edit-add" onClick={() => setSheetOpen(true)}>
            <Plus size={16} weight="bold" /> תנועה
          </button>
        </header>

        <div className="edit-lead">
          <div className="edit-lead-figure-block">
            <span className="edit-lead-label">הון עצמי</span>
            <div className="edit-lead-figure">₪2.45M</div>
            <span className="edit-lead-trend">▲ 4.2% רבעוני</span>
          </div>
          <div className="edit-lead-aside">
            <div className="edit-stat">
              <span className="edit-stat-k">שווי נכס</span>
              <span className="edit-stat-v">₪3,200,000</span>
            </div>
            <div className="edit-stat">
              <span className="edit-stat-k">התחייבויות</span>
              <span className="edit-stat-v">₪750,000</span>
            </div>
            <div className="edit-stat">
              <span className="edit-stat-k">תזרים חודשי</span>
              <span className="edit-stat-v accent">₪8,400</span>
            </div>
            <div className="edit-stat">
              <span className="edit-stat-k">תשואה</span>
              <span className="edit-stat-v">5.6%</span>
            </div>
          </div>
        </div>

        <div className="edit-columns">
          <section className="edit-col">
            <h2 className="edit-col-head">דורש תשומת לב</h2>
            {TASKS.map(t => (
              <article key={t.id} className="edit-attention">
                <span className="edit-attention-num">{t.num}</span>
                <div className="edit-attention-body">
                  <h3 className="edit-attention-title">{t.title}</h3>
                  <span className="edit-attention-meta">{t.meta}</span>
                </div>
                <span className="edit-attention-flag">{t.flag}</span>
              </article>
            ))}
          </section>

          <section className="edit-col edit-col-feed">
            <h2 className="edit-col-head">תנועות</h2>
            {TX.map(tx => (
              <article key={tx.id} className="edit-feed-row">
                <span className="edit-feed-date">{tx.date}</span>
                <span className={`edit-feed-glyph ${tx.dir}`}>
                  {tx.dir === 'income' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                </span>
                <span className="edit-feed-desc">{tx.desc}</span>
                <span className={`edit-feed-amount ${tx.dir}`}>{tx.dir === 'income' ? '+' : '−'}{tx.amount}</span>
              </article>
            ))}
          </section>
        </div>
      </div>

      {/* Liquid overlay input sheet */}
      <div className={`edit-sheet-scrim ${sheetOpen ? 'is-open' : ''}`} onClick={() => setSheetOpen(false)} />
      <aside className={`edit-sheet ${sheetOpen ? 'is-open' : ''}`}>
        <div className="edit-sheet-head">
          <h2>תנועה חדשה</h2>
          <button onClick={() => setSheetOpen(false)} aria-label="סגור"><X size={18} /></button>
        </div>
        <label className="edit-field">
          <span>סכום</span>
          <input type="number" placeholder="₪ 0" autoFocus={sheetOpen} />
        </label>
        <label className="edit-field">
          <span>תיאור</span>
          <input type="text" placeholder="לדוגמה: תיקון דוד שמש" />
        </label>
        <label className="edit-field">
          <span>קטגוריה</span>
          <select defaultValue="">
            <option value="" disabled>בחר</option>
            <option>שכר דירה</option><option>תחזוקה</option><option>ביטוח</option>
          </select>
        </label>
        <button className="edit-sheet-save" onClick={() => setSheetOpen(false)}>שמירת תנועה</button>
      </aside>
    </div>
  )
}
