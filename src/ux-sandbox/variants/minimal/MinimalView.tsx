import { useState } from 'react'
import './minimal.css'
import { ArrowUpRight, ArrowDownLeft, Plus } from '@phosphor-icons/react'

const TASKS = [
  { id: 'a1', title: 'תשלום ארנונה רבעוני', meta: 'יעד · 30 ביוני 2026', flag: 'באיחור' },
  { id: 'a2', title: 'חידוש חוזה — משפ׳ כהן', meta: 'מסתיים · 14 ספטמבר 2026', flag: '88 ימים' },
]

const TX = [
  { id: 't1', dir: 'income', desc: 'שכר דירה — יוני', date: '1 ביוני', amount: '₪6,800' },
  { id: 't2', dir: 'expense', desc: 'תיקון דוד שמש', date: '28 במאי', amount: '₪1,240' },
  { id: 't3', dir: 'expense', desc: 'ביטוח מבנה', date: '24 במאי', amount: '₪320' },
  { id: 't4', dir: 'income', desc: 'החזר ועד בית', date: '18 במאי', amount: '₪150' },
]

export default function MinimalView() {
  const [adding, setAdding] = useState(false)

  return (
    <div className="mnml-root">
      <div className="mnml-page">
        <header className="mnml-header">
          <span className="mnml-eyebrow">דירת מגורים · רחוב הברוש 14</span>
          <h1 className="mnml-title">סקירה</h1>
        </header>

        <section className="mnml-hero">
          <span className="mnml-hero-label">ההון שלי בנכס</span>
          <div className="mnml-hero-figure">₪2,450,000</div>
          <div className="mnml-hero-meta">
            <span>שווי נכס ₪3,200,000</span>
            <span className="mnml-divider-dot" />
            <span>התחייבויות ₪750,000</span>
            <span className="mnml-divider-dot" />
            <span className="mnml-up">▲ 4.2%</span>
          </div>
        </section>

        <section className="mnml-section">
          <h2 className="mnml-section-head">דורש תשומת לב</h2>
          {TASKS.map(t => (
            <div key={t.id} className="mnml-row">
              <div className="mnml-row-main">
                <span className="mnml-row-title">{t.title}</span>
                <span className="mnml-row-meta">{t.meta}</span>
              </div>
              <span className="mnml-row-flag">{t.flag}</span>
              <button className="mnml-row-action" aria-label="פעולה">✓</button>
            </div>
          ))}
        </section>

        <section className="mnml-section">
          <h2 className="mnml-section-head">תנועות אחרונות</h2>
          {TX.map(tx => (
            <div key={tx.id} className="mnml-row">
              <span className={`mnml-tx-glyph ${tx.dir}`}>
                {tx.dir === 'income' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              </span>
              <div className="mnml-row-main">
                <span className="mnml-row-title">{tx.desc}</span>
                <span className="mnml-row-meta">{tx.date}</span>
              </div>
              <span className={`mnml-tx-amount ${tx.dir}`}>
                {tx.dir === 'income' ? '+' : '−'}{tx.amount}
              </span>
            </div>
          ))}

          {/* Borderless add node that inline-expands into a typographical field */}
          <div className={`mnml-add ${adding ? 'is-open' : ''}`}>
            {adding ? (
              <form
                className="mnml-add-form"
                onSubmit={e => { e.preventDefault(); setAdding(false) }}
              >
                <input className="mnml-add-input mnml-add-amount" placeholder="₪ 0" autoFocus />
                <input className="mnml-add-input" placeholder="תיאור התנועה…" />
                <button type="submit" className="mnml-add-submit">שמירה</button>
                <button type="button" className="mnml-add-cancel" onClick={() => setAdding(false)}>ביטול</button>
              </form>
            ) : (
              <button className="mnml-add-trigger" onClick={() => setAdding(true)}>
                <Plus size={14} weight="bold" /> תנועה
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
