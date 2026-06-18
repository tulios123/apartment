import { useState } from 'react'
import './dual-mode.css'
import {
  House, ChartLineUp, ListChecks, FileText, Bank, Gear,
  Plus, X, Check, Warning, TrendUp, ArrowDownLeft, ArrowUpRight,
  Coins, CalendarCheck, ArrowUp, ArrowDown, CheckCircle, ChartPieSlice,
  CaretDown, Flag, Faders, MapPin,
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

// ── Investor model (mock, but internally consistent) ────────────────────────
const MORT = { balance: 750_000, annualRate: 0.032, termMonths: 300, hereMonth: 60 }

function buildSchedule(extra = 0) {
  const r = MORT.annualRate / 12
  const payment = (MORT.balance * r) / (1 - Math.pow(1 + r, -MORT.termMonths))
  let bal = MORT.balance
  let totalInterest = 0
  let month = 0
  const rows: { month: number; interest: number; principal: number }[] = []
  while (bal > 0.5 && month < 600) {
    month++
    const interest = bal * r
    let principal = payment - interest + extra
    if (principal > bal) principal = bal
    bal -= principal
    totalInterest += interest
    rows.push({ month, interest, principal: payment - interest })
  }
  return { rows, payoffMonth: month, totalInterest, payment }
}

const fmt = (v: number) => `₪${Math.round(v).toLocaleString('he-IL')}`

const METRICS = [
  { id: 'gross', label: 'תשואה ברוטו', value: '2.6%', formula: '₪81,600 שכ״ד שנתי ÷ ₪3,200,000 שווי הנכס' },
  { id: 'net', label: 'תשואה נטו', value: '2.2%', formula: '₪69,600 לאחר הוצאות תפעול ÷ ₪3,200,000' },
  { id: 'roe', label: 'תשואה על ההון', value: '4.2%', formula: '₪25,968 תזרים שנתי ÷ ₪620,000 שהושקע' },
]

export default function DualModeView() {
  const [mode, setMode] = useState<Mode>('ops')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [removing, setRemoving] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const [txDir, setTxDir] = useState<'expense' | 'income'>('expense')
  const [openMetric, setOpenMetric] = useState<string | null>(null)
  const [extra, setExtra] = useState(0)

  function resolve(id: string) {
    setRemoving(prev => new Set(prev).add(id))
    setTimeout(() => {
      setResolved(prev => new Set(prev).add(id))
      setRemoving(prev => { const n = new Set(prev); n.delete(id); return n })
    }, 320)
  }

  const liveItems = ATTENTION.filter(a => !resolved.has(a.id))

  // ── Investor computations ──
  const base = buildSchedule(0)
  const whatif = buildSchedule(extra)
  const here = base.rows[MORT.hereMonth - 1]
  const crossover = base.rows.find(x => x.principal > x.interest)
  const crossoverYear = crossover ? Math.ceil(crossover.month / 12) : null
  const monthsSaved = base.payoffMonth - whatif.payoffMonth
  const interestSaved = base.totalInterest - whatif.totalInterest

  // Yearly samples for the chart
  const yearsTotal = Math.round(MORT.termMonths / 12)
  const yearly = Array.from({ length: yearsTotal + 1 }, (_, y) => {
    const idx = Math.min(y * 12, base.rows.length - 1)
    return base.rows[idx]
  })
  const W = 300, H = 140, padX = 10, padTop = 12, padBot = 22
  const maxY = base.payment
  const xFor = (i: number) => padX + (i / yearsTotal) * (W - 2 * padX)
  const yFor = (v: number) => padTop + (1 - v / maxY) * (H - padTop - padBot)
  const line = (key: 'interest' | 'principal') =>
    yearly.map((r, i) => `${xFor(i).toFixed(1)},${yFor(r[key]).toFixed(1)}`).join(' ')
  const principalArea = `${padX},${(H - padBot).toFixed(1)} ${line('principal')} ${xFor(yearsTotal).toFixed(1)},${(H - padBot).toFixed(1)}`
  const crossX = crossover ? xFor(crossover.month / 12) : 0
  const hereX = xFor(MORT.hereMonth / 12)

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

            <div className="dm-fixed-row" onClick={() => setMode('inv')}>
              <div className="dm-fixed-icon"><Coins size={22} weight="duotone" /></div>
              <div className="dm-fixed-info">
                <div className="dm-fixed-title">הוצאות קבועות חודשיות</div>
                <div className="dm-fixed-sub">משכנתא · ביטוח · ועד בית</div>
              </div>
              <div className="dm-fixed-amount">₪3,600</div>
            </div>

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

            {/* Metrics with progressive disclosure */}
            <div className="dm-metrics">
              {METRICS.map(m => (
                <button
                  key={m.id}
                  className={`dm-metric${openMetric === m.id ? ' open' : ''}`}
                  onClick={() => setOpenMetric(openMetric === m.id ? null : m.id)}
                >
                  <div className="dm-metric-top">
                    <span className="dm-metric-label">{m.label}</span>
                    <CaretDown className="dm-metric-caret" size={13} weight="bold" />
                  </div>
                  <div className="dm-metric-value">{m.value}</div>
                  <div className="dm-metric-formula">{m.formula}</div>
                </button>
              ))}
            </div>

            {/* Principal vs interest over the life of the loan */}
            <div className="dm-split-card">
              <div className="dm-split-head"><ChartPieSlice size={18} weight="duotone" /> קרן מול ריבית</div>
              <div className="dm-split-text" style={{ marginBottom: 14 }}>
                החודש: מתוך {fmt(base.payment)} — <b>{fmt(here.principal)} הקטינו את החוב</b>, {fmt(here.interest)} ריבית.
              </div>

              <div className="dm-chart">
                <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="גרף קרן מול ריבית לאורך חיי המשכנתא">
                  <polygon points={principalArea} fill="var(--success-bg)" />
                  <polyline points={line('principal')} fill="none" stroke="var(--success)" strokeWidth="2" />
                  <polyline points={line('interest')} fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="0" />
                  {crossover && (
                    <>
                      <line x1={crossX} y1={padTop} x2={crossX} y2={H - padBot} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" />
                      <circle cx={crossX} cy={yFor(crossover.principal)} r="3.5" fill="var(--accent)" />
                    </>
                  )}
                  <line x1={hereX} y1={padTop} x2={hereX} y2={H - padBot} stroke="var(--navy)" strokeWidth="1" />
                  <circle cx={hereX} cy={yFor(here.principal)} r="3" fill="var(--navy)" />
                  <text x={hereX} y={H - 8} fontSize="9" fill="var(--navy)" textAnchor="middle" fontWeight="600">אתה כאן</text>
                  <text x={padX} y={H - 8} fontSize="9" fill="var(--muted)" textAnchor="start">0</text>
                  <text x={W - padX} y={H - 8} fontSize="9" fill="var(--muted)" textAnchor="end">{yearsTotal} שנים</text>
                </svg>
              </div>
              <div className="dm-chart-legend">
                <span><i className="dm-dot" style={{ background: 'var(--success)' }} /> קרן (החוב שנמחק)</span>
                <span><i className="dm-dot" style={{ background: 'var(--border-strong)' }} /> ריבית (העלות)</span>
              </div>

              {crossoverYear && (
                <div className="dm-crossover">
                  <Flag size={16} weight="fill" />
                  <span>נקודת ההיפוך: <b>שנה {crossoverYear}</b> — מכאן רוב התשלום בונה לך הון, לא ריבית.</span>
                </div>
              )}
            </div>

            {/* What-if prepayment */}
            <div className="dm-split-card">
              <div className="dm-split-head"><Faders size={18} weight="duotone" /> מה אם אקדים תשלום לקרן?</div>
              <div className="dm-whatif-row">
                <input
                  type="range" min={0} max={2000} step={100} value={extra}
                  onChange={e => setExtra(Number(e.target.value))}
                  className="dm-slider"
                />
                <span className="dm-whatif-amount">{extra > 0 ? `+${fmt(extra)}` : '₪0'}<small>/חודש</small></span>
              </div>
              {extra > 0 ? (
                <div className="dm-whatif-result">
                  <div className="dm-whatif-stat">
                    <MapPin size={15} weight="fill" />
                    <span>תסיים <b>{(monthsSaved / 12).toFixed(1)} שנים מוקדם</b> ({whatif.payoffMonth} חודשים בסה״כ)</span>
                  </div>
                  <div className="dm-whatif-stat saved">
                    <TrendUp size={15} weight="bold" />
                    <span>תחסוך <b>{fmt(interestSaved)}</b> בריבית</span>
                  </div>
                </div>
              ) : (
                <div className="dm-whatif-hint">הזז את הסליידר כדי לראות כמה שנים וכמה כסף תחסוך.</div>
              )}
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
