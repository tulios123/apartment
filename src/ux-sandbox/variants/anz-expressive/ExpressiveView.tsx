import './expressive.css'
import {
  House, Coins, Warning, Plus, Sparkle,
  ArrowUpRight, ArrowDownLeft, TrendUp,
} from '@phosphor-icons/react'

const TX = [
  { id: 't1', dir: 'income', desc: 'שכר דירה — יוני', date: '1 ביוני 2026', cat: 'שכירות · אוטומטי', amount: '₪6,800' },
  { id: 't2', dir: 'expense', desc: 'תיקון דוד שמש', date: '28 במאי 2026', cat: 'תחזוקה · מזומן', amount: '₪1,240' },
  { id: 't3', dir: 'expense', desc: 'ביטוח מבנה', date: '24 במאי 2026', cat: 'ביטוח · הוראת קבע', amount: '₪320' },
  { id: 't4', dir: 'income', desc: 'החזר ועד בית', date: '18 במאי 2026', cat: 'אחר · העברה', amount: '₪150' },
]

export default function ExpressiveView() {
  return (
    <div className="exp-root">
      <div className="exp-page">
        <header className="exp-header">
          <div>
            <span className="exp-hi">בוקר טוב, איתי <Sparkle size={18} weight="fill" /></span>
            <h1 className="exp-title">הבריאות הפיננסית שלך מצוינת</h1>
          </div>
        </header>

        <div className="exp-cards">
          <section className="exp-card equity pop" style={{ animationDelay: '0.05s' }}>
            <span className="exp-card-icon"><House size={22} weight="fill" /></span>
            <span className="exp-card-label">הון עצמי</span>
            <div className="exp-card-figure">₪2,450,000</div>
            <span className="exp-card-trend"><TrendUp size={14} weight="bold" /> 4.2%</span>
          </section>

          <section className="exp-card cash pop" style={{ animationDelay: '0.15s' }}>
            <span className="exp-card-icon"><Coins size={22} weight="fill" /></span>
            <span className="exp-card-label">תזרים חודשי</span>
            <div className="exp-card-figure">₪8,400</div>
            <span className="exp-card-trend"><TrendUp size={14} weight="bold" /> 2.1%</span>
          </section>

          <section className="exp-card task pop" style={{ animationDelay: '0.25s' }}>
            <span className="exp-card-icon warn"><Warning size={22} weight="fill" /></span>
            <span className="exp-card-label">דורש תשומת לב</span>
            <div className="exp-card-figure sm">ארנונה רבעונית</div>
            <span className="exp-card-trend warn">באיחור · 30 ביוני</span>
          </section>
        </div>

        <section className="exp-feed pop" style={{ animationDelay: '0.35s' }}>
          <h2 className="exp-feed-head">תנועות אחרונות</h2>
          {TX.map(tx => (
            <div key={tx.id} className={`exp-tx ${tx.dir}`}>
              <span className={`exp-tx-glyph ${tx.dir}`}>
                {tx.dir === 'income' ? <ArrowDownLeft size={16} weight="bold" /> : <ArrowUpRight size={16} weight="bold" />}
              </span>
              <div className="exp-tx-main">
                <div className="exp-tx-top">
                  <span className="exp-tx-desc">{tx.desc}</span>
                  <span className={`exp-tx-amount ${tx.dir}`}>{tx.dir === 'income' ? '+' : '−'}{tx.amount}</span>
                </div>
                <div className="exp-tx-meta">{tx.date} · {tx.cat}</div>
              </div>
            </div>
          ))}
        </section>

        <button className="exp-fab" aria-label="הוסף תנועה"><Plus size={22} weight="bold" /> תנועה</button>
      </div>
    </div>
  )
}
