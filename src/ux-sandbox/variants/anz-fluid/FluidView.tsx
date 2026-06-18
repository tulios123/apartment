import { useState } from 'react'
import './fluid.css'
import {
  Plus, House, Lightning, Drop, ShoppingCart, Wrench,
  ArrowUpRight, ArrowDownLeft, Bell,
} from '@phosphor-icons/react'

type Lens = 'equity' | 'cashflow'

const SPEND = [
  { id: 's1', icon: House, label: 'משכנתא', amount: '₪4,200', tint: 'blue' },
  { id: 's2', icon: Drop, label: 'מים', amount: '₪180', tint: 'teal' },
  { id: 's3', icon: Lightning, label: 'חשמל', amount: '₪320', tint: 'amber' },
  { id: 's4', icon: Wrench, label: 'תחזוקה', amount: '₪1,240', tint: 'violet' },
  { id: 's5', icon: ShoppingCart, label: 'ועד בית', amount: '₪150', tint: 'green' },
]

const TX = [
  { id: 't1', dir: 'income', desc: 'שכר דירה — יוני', date: '1 ביוני', amount: '₪6,800' },
  { id: 't2', dir: 'expense', desc: 'תיקון דוד שמש', date: '28 במאי', amount: '₪1,240' },
  { id: 't3', dir: 'expense', desc: 'ביטוח מבנה', date: '24 במאי', amount: '₪320' },
]

export default function FluidView() {
  const [lens, setLens] = useState<Lens>('equity')

  return (
    <div className="fluid-root">
      <div className="fluid-phone">
        {/* Header block with lens toggle + sliding viewport */}
        <header className="fluid-header">
          <div className="fluid-statusbar">
            <span>שלום, איתי</span>
            <Bell size={18} weight="fill" />
          </div>

          <div className="fluid-toggle">
            <button className={lens === 'equity' ? 'on' : ''} onClick={() => setLens('equity')}>הון</button>
            <button className={lens === 'cashflow' ? 'on' : ''} onClick={() => setLens('cashflow')}>תזרים</button>
          </div>

          <div className="fluid-viewport">
            <div className="fluid-track" data-lens={lens}>
              <div className="fluid-pane">
                <span className="fluid-pane-label">הון עצמי בנכס</span>
                <div className="fluid-pane-figure">₪2,450,000</div>
                <span className="fluid-pane-sub">▲ 4.2% · נכס ₪3.2M · חוב ₪750K</span>
              </div>
              <div className="fluid-pane">
                <span className="fluid-pane-label">תזרים חודשי נטו</span>
                <div className="fluid-pane-figure">₪8,400</div>
                <span className="fluid-pane-sub">▲ 2.1% · הכנסה ₪12K · יציאה ₪3.6K</span>
              </div>
            </div>
          </div>
        </header>

        <main className="fluid-body">
          <h2 className="fluid-h2">פירוט הוצאות</h2>
          <div className="fluid-pills">
            {SPEND.map(({ icon: Icon, ...s }) => (
              <button key={s.id} className={`fluid-pill ${s.tint}`}>
                <span className="fluid-pill-icon"><Icon size={20} weight="fill" /></span>
                <span className="fluid-pill-label">{s.label}</span>
                <span className="fluid-pill-amount">{s.amount}</span>
              </button>
            ))}
          </div>

          <h2 className="fluid-h2">תנועות אחרונות</h2>
          <div className="fluid-tx-list">
            {TX.map(tx => (
              <div key={tx.id} className="fluid-tx">
                <span className={`fluid-tx-glyph ${tx.dir}`}>
                  {tx.dir === 'income' ? <ArrowDownLeft size={16} weight="bold" /> : <ArrowUpRight size={16} weight="bold" />}
                </span>
                <div className="fluid-tx-body">
                  <span className="fluid-tx-desc">{tx.desc}</span>
                  <span className="fluid-tx-date">{tx.date}</span>
                </div>
                <span className={`fluid-tx-amount ${tx.dir}`}>{tx.dir === 'income' ? '+' : '−'}{tx.amount}</span>
              </div>
            ))}
          </div>
        </main>

        {/* Floating round action bubble */}
        <button className="fluid-fab" aria-label="הוסף תנועה"><Plus size={24} weight="bold" /></button>
      </div>
    </div>
  )
}
