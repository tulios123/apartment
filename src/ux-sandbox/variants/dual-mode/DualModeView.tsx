import { useState } from 'react'
import './dual-mode.css'
import {
  House, ChartLineUp, ListChecks, FileText, Bank, Gear,
  Plus, X, Check, Warning, TrendUp, ArrowDownLeft, ArrowUpRight,
  Coins, CalendarCheck, ArrowUp, ArrowDown, CheckCircle, ChartPieSlice,
} from '@phosphor-icons/react'

type Mode = 'ops' | 'inv'

type Attention = {
  id: string
  glyph: 'action' | 'warn' | 'soft'
  icon: typeof House
  title: string
  sub: string
  badge?: { text: string; tone: 'danger' | 'renewal' | 'due' }
  action?: string
}

const ATTENTION: Attention[] = [
  { id: 'a1', glyph: 'action', icon: Coins, title: 'אישור קבלת שכר דירה — יוני', sub: '₪6,800 · משפ׳ כהן', action: 'התקבל' },
  { id: 'a2', glyph: 'warn', icon: Warning, title: 'ארנונה רבעונית', sub: 'יעד · 30 ביוני 2026', badge: { text: 'באיחור', tone: 'danger' } },
  { id: 'a3', glyph: 'soft', icon: FileText, title: 'חידוש חוזה — משפ׳ כהן', sub: 'מסתיים · 14 בספטמבר 2026', badge: { text: '88 ימים', tone: 'renewal' } },
  { id: 'a4', glyph: 'soft', icon: CalendarCheck, title: 'תיאום ביקורת מעלית', sub: 'יעד · 5 ביולי 2026', badge: { text: 'בקרוב', tone: 'due' } },
]

const TX = [
  { id: 't1', dir: 'income', name: 'שכר דירה — יוני', date: '1 ביוני 2026', amount: '₪6,800' },
  { id: 't2', dir: 'expense', name: 'תיקון דוד שמש', date: '28 במאי 2026', amount: '₪1,240' },
  { id: 't3', dir: 'expense', name: 'ביטוח מבנה', date: '24 במאי 2026', amount: '₪320' },
  { id: 't4', dir: 'income', name: 'החזר ועד בית', date: '18 במאי 2026', amount: '₪150' },
]

export default function DualModeView() {
  const [mode, setMode] = useState<Mode>('ops')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [removing, setRemoving] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const [txDir, setTxDir] = useState<'expense' | 'income'>('expense')

  function resolve(id: string) {
    setRemoving(prev => new Set(prev).add(id))
    setTimeout(() => {
      setResolved(prev => new Set(prev).add(id))
      setRemoving(prev => { const n = new Set(prev); n.delete(id); return n })
    }, 320)
  }

  const liveItems = ATTENTION.filter(a => !resolved.has(a.id))

  return (
    <div className="dm-root">
      <aside className="dm-sidebar">
        <div className="dm-sidebar-title">הנכס שלי</div>
        <button className="dm-nav-link active"><House size={18} weight="fill" /> ראשי</button>
        <button className="dm-nav-link"><ChartLineUp size={18} /> פיננסים</button>
        <button className="dm-nav-link"><ListChecks size={18} /> משימות</button>
        <button className="dm-nav-link"><FileText size={18} /> מסמכים</button>
        <button className="dm-nav-link"><Bank size={18} /> התחייבויות</button>
        <button className="dm-nav-link"><Gear size={18} /> הגדרות</button>
      </aside>

      <main className="dm-main">
        <header className="dm-header">
          <div>
            <h1>ראשי</h1>
            <div className="dm-header-sub">דירת מגורים · רחוב הברוש 14</div>
          </div>
          <div className="dm-toggle">
            <button className={mode === 'ops' ? 'on ops' : ''} onClick={() => setMode('ops')}>
              <ListChecks size={16} weight={mode === 'ops' ? 'fill' : 'regular'} /> תפעול
            </button>
            <button className={mode === 'inv' ? 'on inv' : ''} onClick={() => setMode('inv')}>
              <ChartLineUp size={16} weight={mode === 'inv' ? 'fill' : 'regular'} /> השקעה
            </button>
          </div>
        </header>

        {mode === 'ops' ? (
          <div className="dm-view" key="ops">
            {/* Hero — monthly cashflow */}
            <div className="dm-hero">
              <div className="dm-hero-label">תזרים החודש · יוני</div>
              <div className="dm-hero-value pos">+₪8,400</div>
              <div className="dm-flow-bar">
                <div className="seg-in" style={{ width: '70%' }} />
                <div className="seg-out" style={{ width: '30%' }} />
              </div>
              <div className="dm-flow-tiles">
                <div className="dm-flow-tile in">
                  <span className="dm-flow-tile-label"><ArrowDown size={13} weight="bold" /> נכנס</span>
                  <span className="dm-flow-tile-value">₪12,000</span>
                </div>
                <div className="dm-flow-tile out">
                  <span className="dm-flow-tile-label"><ArrowUp size={13} weight="bold" /> יצא</span>
                  <span className="dm-flow-tile-value">₪3,600</span>
                </div>
              </div>
            </div>

            {/* Fixed expenses shortcut */}
            <div className="dm-fixed-row" onClick={() => setMode('inv')}>
              <div className="dm-fixed-icon"><Coins size={22} weight="duotone" /></div>
              <div className="dm-fixed-info">
                <div className="dm-fixed-title">הוצאות קבועות חודשיות</div>
                <div className="dm-fixed-sub">משכנתא · ביטוח · ועד בית</div>
              </div>
              <div className="dm-fixed-amount">₪3,600</div>
            </div>

            {/* Attention */}
            <section className="dm-section">
              <div className="dm-section-head">
                <h2>דורש תשומת לב</h2>
                <button className="dm-link">הכל</button>
              </div>
              {liveItems.length === 0 ? (
                <div className="dm-calm">
                  <div className="dm-calm-icon"><CheckCircle size={28} weight="fill" /></div>
                  <div className="dm-calm-title">אין מה לעשות היום</div>
                  <div className="dm-calm-sub">הנכס שלך עובד בשבילך.</div>
                </div>
              ) : (
                ATTENTION.map(item => {
                  if (resolved.has(item.id)) return null
                  const Icon = item.icon
                  return (
                    <div key={item.id} className={`dm-att ${item.glyph}${removing.has(item.id) ? ' removing' : ''}`}>
                      <div className={`dm-att-glyph ${item.glyph === 'warn' ? 'warn' : item.glyph === 'soft' ? 'soft' : ''}`}>
                        <Icon size={19} weight={item.glyph === 'action' ? 'fill' : 'regular'} />
                      </div>
                      <div className="dm-att-body">
                        <span className="dm-att-title">
                          {item.title}
                          {item.badge && <span className={`dm-badge ${item.badge.tone}`}>{item.badge.text}</span>}
                        </span>
                        <span className="dm-att-sub">{item.sub}</span>
                      </div>
                      {item.action ? (
                        <button className="dm-att-confirm" onClick={() => resolve(item.id)}>
                          <Check size={15} weight="bold" /> {item.action}
                        </button>
                      ) : (
                        <button className="dm-att-check" aria-label="סמן כבוצע" onClick={() => resolve(item.id)}>
                          <Check size={16} weight="bold" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </section>

            {/* Recent transactions */}
            <section className="dm-section">
              <div className="dm-section-head">
                <h2>תנועות אחרונות</h2>
                <button className="dm-link">הכל</button>
              </div>
              {TX.map(tx => (
                <div key={tx.id} className="dm-tx">
                  <span className={`dm-tx-tile ${tx.dir}`}>
                    {tx.dir === 'income' ? <ArrowDownLeft size={17} weight="bold" /> : <ArrowUpRight size={17} weight="bold" />}
                  </span>
                  <span className="dm-tx-cat">
                    <span className="dm-tx-name">{tx.name}</span>
                    <span className="dm-tx-date">{tx.date}</span>
                  </span>
                  <span className={`dm-tx-amount ${tx.dir}`}>{tx.dir === 'income' ? '+' : '−'}{tx.amount}</span>
                </div>
              ))}
            </section>
          </div>
        ) : (
          <div className="dm-view" key="inv">
            {/* Hero — equity */}
            <div className="dm-hero">
              <div className="dm-hero-label">ההון שלי בנכס</div>
              <div className="dm-hero-value">₪2,450,000</div>
              <div className="dm-eq-bar">
                <div className="own" style={{ width: '76%' }} />
                <div className="mort" style={{ width: '24%' }} />
              </div>
              <div className="dm-eq-legend">
                <span><i className="dm-dot own" /> שווי נכס ₪3,200,000</span>
                <span><i className="dm-dot mort" /> חוב ₪750,000</span>
              </div>
            </div>

            <div className="dm-metrics">
              <div className="dm-metric"><div className="dm-metric-label">תשואה ברוטו</div><div className="dm-metric-value">4.2%</div></div>
              <div className="dm-metric"><div className="dm-metric-label">הושקע</div><div className="dm-metric-value">₪620K</div></div>
              <div className="dm-metric"><div className="dm-metric-label">שנגבה</div><div className="dm-metric-value">₪180K</div></div>
            </div>

            <div className="dm-split-card">
              <div className="dm-split-head"><ChartPieSlice size={18} weight="duotone" /> קרן מול ריבית — יוני</div>
              <div className="dm-split-bar">
                <div className="principal" style={{ width: '70%' }} />
                <div className="interest" style={{ width: '30%' }} />
              </div>
              <div className="dm-split-text">מתוך ₪3,600 ששילמת — <b>₪2,520 הקטינו את החוב</b>, ₪1,080 בלבד ריבית.</div>
            </div>

            <div className="dm-insight">
              <TrendUp className="dm-insight-icon" size={20} weight="bold" />
              <span className="dm-insight-text">ההון שלך גדל ב‑₪3,100 החודש — בזמן שישנת.</span>
            </div>
          </div>
        )}
      </main>

      <button className="dm-fab" onClick={() => setDrawerOpen(true)} aria-label="הוסף תנועה"><Plus size={26} weight="bold" /></button>

      <div className={`dm-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`dm-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="dm-drawer-head">
          <h2>תנועה חדשה</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button>
        </div>
        <div className="dm-seg">
          <button className={txDir === 'expense' ? 'on' : ''} onClick={() => setTxDir('expense')}>הוצאה</button>
          <button className={txDir === 'income' ? 'on' : ''} onClick={() => setTxDir('income')}>הכנסה</button>
        </div>
        <label className="dm-field"><span>סכום ₪</span><input type="number" placeholder="0.00" autoFocus={drawerOpen} /></label>
        <label className="dm-field"><span>קטגוריה</span>
          <select defaultValue=""><option value="" disabled>בחר</option><option>שכירות</option><option>תחזוקה</option><option>ביטוח</option><option>חשבונות</option></select>
        </label>
        <label className="dm-field"><span>תיאור</span><input type="text" placeholder="לדוגמה: תיקון דוד שמש" /></label>
        <button className="dm-save" onClick={() => setDrawerOpen(false)}>שמירת תנועה</button>
      </aside>
    </div>
  )
}
