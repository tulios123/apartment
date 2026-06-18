import { useState, useMemo } from 'react'
import './finances.css'
import {
  House, ChartLineUp, ListChecks, FileText, Bank, Gear,
  Plus, X, CaretDown, CaretLeft, CaretRight, Sparkle, ArrowUp, ArrowDown,
  PencilSimple, Trash, Receipt, Wrench, ShieldCheck, Percent, DotsThree, ChartPie,
} from '@phosphor-icons/react'

type Dir = 'income' | 'expense'
type CatKey = 'rent' | 'mortgage' | 'repair' | 'insurance' | 'interest' | 'other'

type Tx = {
  id: string
  m: number
  date: string
  dir: Dir
  cat: string
  catKey: CatKey
  amount: number
  meta?: string
  projected?: boolean
  receipt?: boolean
  isNew?: boolean
}

const CAT_META: Record<CatKey, { icon: typeof House; fill: string }> = {
  rent: { icon: House, fill: 'var(--success)' },
  mortgage: { icon: Bank, fill: 'var(--accent)' },
  repair: { icon: Wrench, fill: 'var(--coral)' },
  insurance: { icon: ShieldCheck, fill: 'var(--purple)' },
  interest: { icon: Percent, fill: 'var(--amber)' },
  other: { icon: DotsThree, fill: 'var(--muted)' },
}

const MONTHS = [
  { m: 5, label: 'מאי 2026' },
  { m: 6, label: 'יוני 2026' },
  { m: 7, label: 'יולי 2026' },
]

const INITIAL: Tx[] = [
  { id: 'j1', m: 6, date: '1 ביוני', dir: 'income', cat: 'שכר דירה', catKey: 'rent', amount: 6800, meta: 'הוראת קבע · משפ׳ כהן' },
  { id: 'j2', m: 6, date: '3 ביוני', dir: 'expense', cat: 'משכנתא – בנק', catKey: 'mortgage', amount: 3636, meta: 'הוראת קבע', projected: true },
  { id: 'j3', m: 6, date: '12 ביוני', dir: 'expense', cat: 'תיקונים', catKey: 'repair', amount: 1240, meta: 'תיקון דוד שמש · ביט', receipt: true },
  { id: 'j4', m: 6, date: '18 ביוני', dir: 'expense', cat: 'ביטוח', catKey: 'insurance', amount: 320, meta: 'ביטוח מבנה · העברה בנקאית' },
  { id: 'j5', m: 6, date: '25 ביוני', dir: 'expense', cat: 'אחר', catKey: 'other', amount: 150, meta: 'ועד בית' },
  { id: 'k1', m: 5, date: '1 במאי', dir: 'income', cat: 'שכר דירה', catKey: 'rent', amount: 6800, meta: 'הוראת קבע · משפ׳ כהן' },
  { id: 'k2', m: 5, date: '3 במאי', dir: 'expense', cat: 'משכנתא – בנק', catKey: 'mortgage', amount: 3636, meta: 'הוראת קבע', projected: true },
  { id: 'k3', m: 5, date: '9 במאי', dir: 'expense', cat: 'תיקונים', catKey: 'repair', amount: 900, meta: 'צביעת קירות' },
]

const fmt = (v: number) => `₪${Math.round(v).toLocaleString('he-IL')}`

function parse(text: string): { amount: number | null; dir: Dir; cat: string; catKey: CatKey; date: string; desc: string } {
  const amountMatch = text.match(/[\d,]+(\.\d+)?/)
  const amount = amountMatch ? Number(amountMatch[0].replace(/,/g, '')) : null
  const income = /(קיבלתי|נכנס|הכנסה|שכ"ד|שכ״ד|שכירות|שכר)/.test(text)
  const dir: Dir = income ? 'income' : 'expense'
  let cat = 'אחר', catKey: CatKey = 'other'
  if (/תיקון|נזק|אינסטל|חשמלאי|צביע/.test(text)) { cat = 'תיקונים'; catKey = 'repair' }
  else if (/ביטוח/.test(text)) { cat = 'ביטוח'; catKey = 'insurance' }
  else if (/ריבית/.test(text)) { cat = 'ריבית'; catKey = 'interest' }
  else if (/משכנת/.test(text)) { cat = 'משכנתא – בנק'; catKey = 'mortgage' }
  else if (income) { cat = 'שכר דירה'; catKey = 'rent' }
  const date = /אתמול/.test(text) ? 'אתמול' : 'היום'
  const m = text.match(/(?:על|עבור)\s+(.+)/)
  const desc = m ? m[1].trim() : ''
  return { amount, dir, cat, catKey, date, desc }
}

export default function FinancesView() {
  const [monthIdx, setMonthIdx] = useState(1) // יוני
  const [txs, setTxs] = useState<Tx[]>(INITIAL)
  const [capture, setCapture] = useState('')
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [txDir, setTxDir] = useState<Dir>('expense')

  const month = MONTHS[monthIdx]
  const filtered = txs.filter(t => t.m === month.m)
  const income = filtered.filter(t => t.dir === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = filtered.filter(t => t.dir === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expense
  const inPct = income + expense > 0 ? (income / (income + expense)) * 100 : 50

  const parsed = parse(capture)
  const showChips = parsed.amount != null

  const breakdown = useMemo(() => {
    const map = new Map<string, { amount: number; catKey: CatKey }>()
    filtered.filter(t => t.dir === 'expense').forEach(t => {
      const cur = map.get(t.cat) ?? { amount: 0, catKey: t.catKey }
      cur.amount += t.amount
      map.set(t.cat, cur)
    })
    const arr = Array.from(map.entries()).map(([cat, v]) => ({ cat, ...v })).sort((a, b) => b.amount - a.amount)
    const max = arr[0]?.amount ?? 1
    return arr.map(a => ({ ...a, pct: (a.amount / max) * 100 }))
  }, [filtered])

  function addFromCapture() {
    if (parsed.amount == null) return
    const tx: Tx = {
      id: `n${Date.now()}`, m: month.m, date: parsed.date, dir: parsed.dir,
      cat: parsed.cat, catKey: parsed.catKey, amount: parsed.amount,
      meta: parsed.desc || undefined, isNew: true,
    }
    setTxs(prev => [tx, ...prev])
    setCapture('')
  }

  return (
    <div className="fin-root">
      <aside className="fin-sidebar">
        <div className="fin-sidebar-title">הנכס שלי</div>
        <a className="fin-nav-link" href="/ux-sandbox/dual-mode"><House size={18} /> ראשי</a>
        <a className="fin-nav-link active" href="/ux-sandbox/finances"><ChartLineUp size={18} weight="fill" /> פיננסים</a>
        <button className="fin-nav-link"><ListChecks size={18} /> משימות</button>
        <button className="fin-nav-link"><FileText size={18} /> מסמכים</button>
        <a className="fin-nav-link" href="/ux-sandbox/liabilities"><Bank size={18} /> התחייבויות</a>
        <button className="fin-nav-link"><Gear size={18} /> הגדרות</button>
      </aside>

      <main className="fin-main">
        <div className="fin-head">
          <h1>כספים</h1>
          <div className="fin-tabs">
            <button className="fin-tab active">תנועות</button>
            <button className="fin-tab">קבועים</button>
          </div>
        </div>

        {/* Month navigator */}
        <div className="fin-monthnav">
          <button className="fin-monthnav-btn" disabled={monthIdx === 0} onClick={() => setMonthIdx(i => Math.max(0, i - 1))} aria-label="חודש קודם"><CaretRight size={18} weight="bold" /></button>
          <span className="fin-monthnav-label">{month.label}</span>
          <button className="fin-monthnav-btn" disabled={monthIdx === MONTHS.length - 1} onClick={() => setMonthIdx(i => Math.min(MONTHS.length - 1, i + 1))} aria-label="חודש הבא"><CaretLeft size={18} weight="bold" /></button>
        </div>

        {/* Month summary */}
        <div className="fin-summary">
          <div className="fin-summary-label">מאזן החודש</div>
          <div className={`fin-summary-net ${net >= 0 ? 'pos' : 'neg'}`}>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}</div>
          <div className="fin-summary-bar">
            <div className="in" style={{ width: `${inPct}%` }} />
            <div className="out" style={{ width: `${100 - inPct}%` }} />
          </div>
          <div className="fin-summary-tiles">
            <div className="fin-summary-tile in">
              <span className="fin-summary-tile-label"><ArrowDown size={13} weight="bold" /> הכנסות</span>
              <span className="fin-summary-tile-value">{fmt(income)}</span>
            </div>
            <div className="fin-summary-tile out">
              <span className="fin-summary-tile-label"><ArrowUp size={13} weight="bold" /> הוצאות</span>
              <span className="fin-summary-tile-value">{fmt(expense)}</span>
            </div>
          </div>
        </div>

        {/* Zero-friction capture */}
        <div className="fin-capture">
          <div className="fin-capture-row">
            <Sparkle className="fin-capture-icon" size={20} weight="fill" />
            <input
              className="fin-capture-input"
              placeholder="הזנה מהירה — לדוגמה: שילמתי 1,240 על תיקון דוד שמש"
              value={capture}
              onChange={e => setCapture(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addFromCapture() }}
            />
            <button className="fin-capture-send" disabled={!showChips} onClick={addFromCapture} aria-label="הוסף תנועה"><Plus size={18} weight="bold" /></button>
          </div>
          {showChips ? (
            <div className="fin-chips">
              <span className="fin-chip amount">{fmt(parsed.amount!)}</span>
              <span className={`fin-chip dir-${parsed.dir}`}>{parsed.dir === 'income' ? 'הכנסה' : 'הוצאה'}</span>
              <span className="fin-chip">{parsed.cat}</span>
              <span className="fin-chip">{parsed.date}</span>
              {parsed.desc && <span className="fin-chip">{parsed.desc}</span>}
            </div>
          ) : (
            <div className="fin-capture-hint">
              כתוב במילים שלך, או <button className="fin-capture-structured" onClick={() => setDrawerOpen(true)}>פתח טופס מלא</button>
            </div>
          )}
        </div>

        {/* Collapsible breakdown */}
        {expense > 0 && (
          <div className={`fin-breakdown ${breakdownOpen ? 'open' : ''}`}>
            <button className="fin-breakdown-head" onClick={() => setBreakdownOpen(o => !o)}>
              <h3><ChartPie size={17} weight="duotone" /> פילוח הוצאות לפי קטגוריה</h3>
              <CaretDown className="fin-breakdown-caret" size={15} weight="bold" />
            </button>
            <div className="fin-breakdown-body">
              <div className="fin-breakdown-inner">
                {breakdown.map(b => (
                  <div key={b.cat} className="fin-bd-row">
                    <span className="fin-bd-label"><i style={{ width: 9, height: 9, borderRadius: 3, background: CAT_META[b.catKey].fill, display: 'inline-block' }} /> {b.cat}</span>
                    <span className="fin-bd-track"><span className="fin-bd-fill" style={{ width: `${b.pct}%`, background: CAT_META[b.catKey].fill }} /></span>
                    <span className="fin-bd-amount">{fmt(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="fin-section-head">
          <h2>תנועות</h2>
          {filtered.some(t => t.projected) && <span className="fin-legend">מקווקו = תחזית מהחוזה/משכנתא</span>}
        </div>

        {filtered.length === 0 ? (
          <div className="fin-empty">
            <div className="fin-empty-icon"><Receipt size={26} /></div>
            <div className="fin-empty-title">אין תנועות בחודש זה</div>
            <div className="fin-empty-sub">השתמש בהזנה המהירה למעלה כדי להוסיף.</div>
          </div>
        ) : (
          filtered.map(t => {
            const Icon = CAT_META[t.catKey].icon
            return (
              <div key={t.id} className={`fin-tx ${t.projected ? 'projected' : ''} ${t.isNew ? 'new' : ''}`}>
                <span className={`fin-cat-icon ${t.catKey}`}><Icon size={20} weight={t.dir === 'income' ? 'fill' : 'regular'} /></span>
                <div className="fin-tx-body">
                  <div className="fin-tx-top">
                    <span className="fin-tx-cat">{t.cat}</span>
                    {t.projected && <span className="fin-tx-tag">תחזית</span>}
                  </div>
                  <span className="fin-tx-meta">{t.date}{t.meta ? ` · ${t.meta}` : ''}</span>
                </div>
                <div className="fin-tx-side">
                  <span className={`fin-tx-amount ${t.dir}`}>{t.dir === 'income' ? '+' : '−'}{fmt(t.amount)}</span>
                  {!t.projected && (
                    <div className="fin-tx-actions">
                      {t.receipt && <button className="fin-icon-btn" aria-label="קבלה"><Receipt size={15} /></button>}
                      <button className="fin-icon-btn" aria-label="עריכה"><PencilSimple size={15} /></button>
                      <button className="fin-icon-btn danger" aria-label="מחיקה" onClick={() => setTxs(prev => prev.filter(x => x.id !== t.id))}><Trash size={15} /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </main>

      <button className="fin-fab" onClick={() => setDrawerOpen(true)} aria-label="הוסף תנועה"><Plus size={26} weight="bold" /></button>

      <div className={`fin-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`fin-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="fin-drawer-head">
          <h2>תנועה חדשה</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button>
        </div>
        <div className="fin-seg">
          <button className={txDir === 'expense' ? 'on' : ''} onClick={() => setTxDir('expense')}>הוצאה</button>
          <button className={txDir === 'income' ? 'on' : ''} onClick={() => setTxDir('income')}>הכנסה</button>
        </div>
        <label className="fin-field"><span>סכום ₪</span><input type="number" placeholder="0.00" autoFocus={drawerOpen} /></label>
        <label className="fin-field"><span>תאריך</span><input type="date" defaultValue="2026-06-18" /></label>
        <label className="fin-field"><span>קטגוריה</span>
          <select defaultValue=""><option value="" disabled>בחר</option><option>שכר דירה</option><option>תיקונים</option><option>ביטוח</option><option>ריבית</option><option>אחר</option></select>
        </label>
        <label className="fin-field"><span>אמצעי תשלום</span>
          <select defaultValue=""><option value="">לא צוין</option><option>ביט</option><option>מזומן</option><option>העברה בנקאית</option><option>הוראת קבע</option></select>
        </label>
        <label className="fin-field"><span>תיאור</span><input type="text" placeholder="אופציונלי" /></label>
        <button className="fin-save" onClick={() => setDrawerOpen(false)}>שמירת תנועה</button>
      </aside>
    </div>
  )
}
