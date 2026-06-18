import { useState } from 'react'
import './liabilities.css'
import {
  House, ChartLineUp, ListChecks, FileText, Bank, Gear,
  Plus, X, CaretDown, HandCoins, Scales,
} from '@phosphor-icons/react'

type TrackType = 'prime' | 'fixed_unlinked' | 'fixed_linked' | 'variable'
type Color = 'blue' | 'teal' | 'purple' | 'amber'

const TRACK_LABEL: Record<TrackType, string> = {
  prime: 'פריים',
  fixed_unlinked: 'קבועה לא צמודה',
  fixed_linked: 'קבועה צמודה',
  variable: 'משתנה',
}
const TRACK_COLOR: Record<TrackType, Color> = {
  prime: 'blue', fixed_unlinked: 'teal', fixed_linked: 'purple', variable: 'amber',
}

type Track = {
  id: string; type: TrackType; orig: number; balance: number; rate: number
  monthly: number; termYears: number; endYear: number; interestPaid: number; interestLeft: number
}

const TRACKS: Track[] = [
  { id: 'p', type: 'prime', orig: 280_000, balance: 230_000, rate: 6.0, monthly: 1500, termYears: 25, endYear: 2047, interestPaid: 48_000, interestLeft: 110_000 },
  { id: 'f', type: 'fixed_unlinked', orig: 330_000, balance: 270_000, rate: 4.3, monthly: 1550, termYears: 25, endYear: 2047, interestPaid: 41_000, interestLeft: 95_000 },
  { id: 'v', type: 'variable', orig: 150_000, balance: 120_000, rate: 3.9, monthly: 700, termYears: 20, endYear: 2042, interestPaid: 14_000, interestLeft: 38_000 },
]

type Loan = {
  id: string; label: string; lender: string; orig: number; balance: number
  rate: number; monthly: number; termYears: number; endYear: number; interestPaid: number; interestLeft: number
}
const MONTHLY_LOANS: Loan[] = [
  { id: 'l1', label: 'הלוואת שיפוץ', lender: 'בנק הפועלים', orig: 70_000, balance: 50_000, rate: 7.0, monthly: 1050, termYears: 5, endYear: 2028, interestPaid: 6_000, interestLeft: 4_500 },
]
const BALLOON = { id: 'b1', label: 'הלוואת משפחה', lender: 'הלוואה פרטית', balance: 80_000 }

const fmt = (v: number) => `₪${Math.round(v).toLocaleString('he-IL')}`

export default function LiabilitiesView() {
  const [open, setOpen] = useState<string | null>('p')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [kind, setKind] = useState<'mortgage' | 'loan'>('mortgage')

  const mortgageBalance = TRACKS.reduce((s, t) => s + t.balance, 0)
  const loanBalance = MONTHLY_LOANS.reduce((s, l) => s + l.balance, 0)
  const total = mortgageBalance + loanBalance + BALLOON.balance
  const monthly = TRACKS.reduce((s, t) => s + t.monthly, 0) + MONTHLY_LOANS.reduce((s, l) => s + l.monthly, 0)
  const interestLeft = TRACKS.reduce((s, t) => s + t.interestLeft, 0) + MONTHLY_LOANS.reduce((s, l) => s + l.interestLeft, 0)
  const pct = (v: number) => (v / total) * 100

  return (
    <div className="lia-root">
      <aside className="lia-sidebar">
        <div className="lia-sidebar-title">הנכס שלי</div>
        <a className="lia-nav-link" href="/ux-sandbox/dual-mode"><House size={18} /> ראשי</a>
        <a className="lia-nav-link" href="/ux-sandbox/finances"><ChartLineUp size={18} /> פיננסים</a>
        <button className="lia-nav-link"><ListChecks size={18} /> משימות</button>
        <button className="lia-nav-link"><FileText size={18} /> מסמכים</button>
        <button className="lia-nav-link active"><Bank size={18} weight="fill" /> התחייבויות</button>
        <button className="lia-nav-link"><Gear size={18} /> הגדרות</button>
      </aside>

      <main className="lia-main">
        <h1>התחייבויות</h1>

        {/* Debt overview */}
        <div className="lia-hero">
          <div className="lia-hero-label">סך התחייבויות</div>
          <div className="lia-hero-value">{fmt(total)}</div>
          <div className="lia-comp-bar">
            <div className="mortgage" style={{ width: `${pct(mortgageBalance)}%` }} />
            <div className="loan" style={{ width: `${pct(loanBalance)}%` }} />
            <div className="balloon" style={{ width: `${pct(BALLOON.balance)}%` }} />
          </div>
          <div className="lia-comp-legend">
            <span><i className="lia-comp-dot" style={{ background: '#5aa0ec' }} /> משכנתא {fmt(mortgageBalance)}</span>
            <span><i className="lia-comp-dot" style={{ background: 'var(--teal)' }} /> הלוואה {fmt(loanBalance)}</span>
            <span><i className="lia-comp-dot" style={{ background: '#f0b24e' }} /> בלון {fmt(BALLOON.balance)}</span>
          </div>
          <div className="lia-hero-foot">
            <div><span>תשלום חודשי</span><strong>{fmt(monthly)}</strong></div>
            <div><span>ריבית שנותרה לתשלום</span><strong>{fmt(interestLeft)}</strong></div>
          </div>
        </div>

        {/* Mortgage mix */}
        <section className="lia-section">
          <div className="lia-section-head">
            <Bank size={18} weight="duotone" color="var(--navy)" />
            <h2>תמהיל המשכנתא</h2>
            <span className="count">· {TRACKS.length} מסלולים</span>
          </div>
          {TRACKS.map(t => {
            const color = TRACK_COLOR[t.type]
            const paidPct = ((t.orig - t.balance) / t.orig) * 100
            const isOpen = open === t.id
            return (
              <div key={t.id} className={`lia-card${isOpen ? ' open' : ''}`}>
                <button className="lia-card-head" onClick={() => setOpen(isOpen ? null : t.id)}>
                  <span className={`lia-card-badge ${color}`}>{TRACK_LABEL[t.type]}</span>
                  <div className="lia-card-main">
                    <div className="lia-card-title">{fmt(t.monthly)} לחודש</div>
                    <div className="lia-card-sub">ריבית {t.rate.toFixed(1)}% · עד {t.endYear}</div>
                  </div>
                  <div className="lia-card-balance"><b>{fmt(t.balance)}</b><span>יתרה</span></div>
                  <CaretDown className="lia-card-caret" size={16} weight="bold" />
                </button>
                <div className="lia-progress">
                  <div className="lia-progress-track"><div className={`lia-progress-fill ${color}`} style={{ width: `${paidPct}%` }} /></div>
                  <div className="lia-progress-labels"><span>נפרעו {Math.round(paidPct)}%</span><span>מתוך {fmt(t.orig)}</span></div>
                </div>
                <div className="lia-detail">
                  <div className="lia-detail-inner">
                    <div className="lia-detail-grid">
                      <div className="lia-detail-item"><span>קרן מקורית</span><strong>{fmt(t.orig)}</strong></div>
                      <div className="lia-detail-item"><span>תקופה</span><strong>{t.termYears} שנים</strong></div>
                      <div className="lia-detail-item"><span>ריבית ששולמה</span><strong className="interest">{fmt(t.interestPaid)}</strong></div>
                      <div className="lia-detail-item"><span>ריבית שנותרה</span><strong className="interest">{fmt(t.interestLeft)}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        {/* Loans */}
        <section className="lia-section">
          <div className="lia-section-head">
            <HandCoins size={18} weight="duotone" color="var(--navy)" />
            <h2>הלוואות</h2>
          </div>
          {MONTHLY_LOANS.map(l => {
            const paidPct = ((l.orig - l.balance) / l.orig) * 100
            const isOpen = open === l.id
            return (
              <div key={l.id} className={`lia-card${isOpen ? ' open' : ''}`}>
                <button className="lia-card-head" onClick={() => setOpen(isOpen ? null : l.id)}>
                  <span className="lia-card-badge teal">שפיצר</span>
                  <div className="lia-card-main">
                    <div className="lia-card-title">{l.label}</div>
                    <div className="lia-card-sub">{l.lender} · {fmt(l.monthly)} לחודש · {l.rate.toFixed(1)}%</div>
                  </div>
                  <div className="lia-card-balance"><b>{fmt(l.balance)}</b><span>יתרה</span></div>
                  <CaretDown className="lia-card-caret" size={16} weight="bold" />
                </button>
                <div className="lia-progress">
                  <div className="lia-progress-track"><div className="lia-progress-fill teal" style={{ width: `${paidPct}%` }} /></div>
                  <div className="lia-progress-labels"><span>נפרעו {Math.round(paidPct)}%</span><span>עד {l.endYear}</span></div>
                </div>
                <div className="lia-detail">
                  <div className="lia-detail-inner">
                    <div className="lia-detail-grid">
                      <div className="lia-detail-item"><span>קרן מקורית</span><strong>{fmt(l.orig)}</strong></div>
                      <div className="lia-detail-item"><span>תקופה</span><strong>{l.termYears} שנים</strong></div>
                      <div className="lia-detail-item"><span>ריבית ששולמה</span><strong className="interest">{fmt(l.interestPaid)}</strong></div>
                      <div className="lia-detail-item"><span>ריבית שנותרה</span><strong className="interest">{fmt(l.interestLeft)}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Balloon — distinct */}
          <div className="lia-balloon">
            <div className="lia-balloon-icon"><Scales size={20} weight="duotone" /></div>
            <div className="lia-balloon-main">
              <div className="lia-balloon-title">{BALLOON.label} · <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{BALLOON.lender}</span></div>
              <div className="lia-balloon-note">בלון · נפרע במכירת הנכס · ללא תשלום חודשי</div>
            </div>
            <div className="lia-balloon-amount">{fmt(BALLOON.balance)}</div>
          </div>
        </section>
      </main>

      <button className="lia-fab" onClick={() => setDrawerOpen(true)} aria-label="הוסף התחייבות"><Plus size={26} weight="bold" /></button>

      <div className={`lia-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`lia-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="lia-drawer-head">
          <h2>הוספת התחייבות</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button>
        </div>
        <div className="lia-seg">
          <button className={kind === 'mortgage' ? 'on' : ''} onClick={() => setKind('mortgage')}>מסלול משכנתא</button>
          <button className={kind === 'loan' ? 'on' : ''} onClick={() => setKind('loan')}>הלוואה</button>
        </div>
        {kind === 'mortgage' ? (
          <label className="lia-field"><span>סוג מסלול</span>
            <select defaultValue="prime">
              <option value="prime">פריים</option>
              <option value="fixed_unlinked">קבועה לא צמודה (קל"צ)</option>
              <option value="fixed_linked">קבועה צמודה</option>
              <option value="variable">משתנה</option>
            </select>
          </label>
        ) : (
          <label className="lia-field"><span>סוג החזר</span>
            <select defaultValue="monthly_fixed">
              <option value="monthly_fixed">שפיצר (חודשי קבוע)</option>
              <option value="balloon">בלון (נפרע במכירה)</option>
            </select>
          </label>
        )}
        <div className="lia-row2">
          <label className="lia-field"><span>קרן ₪</span><input type="number" placeholder="0" autoFocus={drawerOpen} /></label>
          <label className="lia-field"><span>ריבית %</span><input type="number" placeholder="0.0" step="0.1" /></label>
        </div>
        <div className="lia-row2">
          <label className="lia-field"><span>תקופה (חודשים)</span><input type="number" placeholder="300" /></label>
          <label className="lia-field"><span>תחילה</span><input type="date" defaultValue="2026-06-01" /></label>
        </div>
        <button className="lia-save" onClick={() => setDrawerOpen(false)}>שמירה</button>
      </aside>
    </div>
  )
}
