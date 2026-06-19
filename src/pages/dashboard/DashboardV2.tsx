import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ListChecks, ChartLineUp, ArrowDown, ArrowUp, ArrowDownLeft, ArrowUpRight,
  Coins, CheckCircle, Warning, FileText, CalendarCheck, CaretDown, Flag, Faders,
  MapPin, TrendUp, ChartPieSlice,
} from '@phosphor-icons/react'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import { useMortgageData } from '../../hooks/useMortgageData'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { useLoansData } from '../../hooks/useLoansData'
import { useInsurance } from '../../hooks/useInsurance'
import { formatCurrency, formatDate } from '../../lib/format'
import { gracePeriodPayment } from '../../lib/mortgage'
import { activeContract as findActiveContract, monthlyVirtualEntries } from '../../lib/projections'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../../lib/constants'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState, PageError } from '../../components/ui/EmptyState'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
import './dashboard-v2.css'

type Mode = 'ops' | 'inv'
const fmt = (v: number) => formatCurrency(v)

export default function DashboardV2() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('ops')
  const [openMetric, setOpenMetric] = useState<string | null>(null)
  const [extra, setExtra] = useState(0)

  const { recentTransactions, openTasks, upcomingRenewals, loading: loadingStats, error } = useDashboardStats()
  const { summary, tracks, combined, loading: loadingMortgage } = useMortgageData()
  const { property, contracts, utilities, loading: loadingProperty } = usePropertyData()
  const { totalInvested, rentReceived, loading: loadingInvestment } = useInvestmentData()
  const { monthlyLoans, summary: loansSummary, loading: loadingLoans } = useLoansData()
  const { policies, loading: loadingInsurance } = useInsurance()

  const summaryLoading = loadingProperty || loadingMortgage || loadingInvestment || loadingLoans
  const flowLoading = loadingProperty || loadingMortgage || loadingInsurance || loadingStats
  const recentLoading = loadingStats || loadingProperty || loadingMortgage

  if (error) return <PageError message={error} />

  // ── Computations (mirrors Dashboard.tsx) ──
  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const mortgageBalance = summary.currentBalance || 0
  const loanBalance = loansSummary.monthlyBalance || 0
  const balloonBalance = loansSummary.balloonOutstanding || 0
  const totalDebt = mortgageBalance + loanBalance + balloonBalance
  const equity = propertyValue - totalDebt

  const now = new Date()
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const monthlyMortgage = summary.monthlyPayment || 0
  const monthlyLoan = loansSummary.monthlyPayment || 0
  const monthlyInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)

  const hasGrace = tracks.some(t => (t.grace_months ?? 0) > 0)
  const selectedMortgage = hasGrace ? gracePeriodPayment(tracks) : monthlyMortgage

  const activeContractId = activeContract?.id
  const ownerUtilities = utilities.filter(u =>
    u.payer === 'owner' && u.amount != null && u.amount > 0 &&
    (!activeContractId || u.contract_id === activeContractId)
  )
  const monthlyOwnerUtilities = ownerUtilities.reduce((s, u) => s + (u.amount ?? 0), 0)
  const fixedExpenses = selectedMortgage + monthlyLoan + monthlyInsurance + monthlyOwnerUtilities
  const monthlyNet = monthlyRent - fixedExpenses
  const grossYield = propertyValue > 0 && monthlyRent > 0 ? (monthlyRent * 12 / propertyValue) * 100 : null

  const barPct = (v: number) => propertyValue > 0 ? Math.max(0, Math.min(100, (v / propertyValue) * 100)) : 0

  const todayStr = now.toISOString().slice(0, 10)
  const monthPrefix = todayStr.slice(0, 7)
  const rentCatSet = new Set(RENT_CATEGORIES as readonly string[])
  const mortCatSet = new Set(MORTGAGE_CATEGORIES as readonly string[])

  // Attention items (tasks + renewals)
  type AttentionItem = { key: string; title: string; date: string | null; daysLeft?: number; renewal: boolean; overdue: boolean; onClick: () => void }
  const taskItems: AttentionItem[] = openTasks.map(task => ({
    key: `task-${task.id}`, title: task.title, date: task.due_date ?? null, renewal: false,
    overdue: !!task.due_date && task.due_date < todayStr, onClick: () => navigate('/tasks'),
  }))
  const renewalItems: AttentionItem[] = upcomingRenewals.map(({ contract, daysLeft }) => ({
    key: `renewal-${contract.id}`, title: `${contract.company_name} — חידוש`, date: contract.end_date,
    daysLeft, renewal: true, overdue: daysLeft <= 30, onClick: () => navigate('/property/rental'),
  }))
  const attentionItems = [...taskItems, ...renewalItems]
    .sort((a, b) => (!a.date && !b.date) ? 0 : !a.date ? 1 : !b.date ? -1 : a.date.localeCompare(b.date))
    .slice(0, 5)

  // Cashflow extras this month
  const thisMonthTxs = recentTransactions.filter(t => t.date.startsWith(monthPrefix))
  const extraIncomeTxs = thisMonthTxs.filter(t => t.direction === 'income' && !rentCatSet.has(t.category))
  const extraExpenseTxs = thisMonthTxs.filter(t => t.direction === 'expense' && !mortCatSet.has(t.category))
  const extraIncome = extraIncomeTxs.reduce((s, t) => s + t.amount, 0)
  const extraExpense = extraExpenseTxs.reduce((s, t) => s + t.amount, 0)
  const adjustedNet = monthlyNet + extraIncome - extraExpense
  const totalIncome = monthlyRent + extraIncome
  const totalExpense = fixedExpenses + extraExpense
  const inPct = totalIncome + totalExpense > 0 ? (totalIncome / (totalIncome + totalExpense)) * 100 : 50

  // Recent (real + virtual)
  const realRecent = recentTransactions
    .filter(t => !(t.direction === 'income' && rentCatSet.has(t.category)))
    .filter(t => !(t.direction === 'expense' && mortCatSet.has(t.category)))
    .map(t => ({ id: t.id, date: t.date, category: t.category, direction: t.direction, amount: t.amount }))
  const virtualRecent = monthlyVirtualEntries(contracts, tracks, now.getFullYear(), undefined, monthlyLoans)
    .map(v => ({ id: v.id, date: v.date, category: v.category, direction: v.direction, amount: v.amount }))
  const recentItems = [...realRecent, ...virtualRecent].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  // ── Investor: principal vs interest from real combined schedule ──
  const hereRow = [...combined].reverse().find(r => r.date <= todayStr) ?? combined[0]
  const crossover = combined.find(r => r.principal > r.interest)
  const crossoverYear = crossover ? Math.ceil(crossover.monthIndex / 12) : null
  const interestPaidPct = summary.totalInterestLife > 0 ? (summary.interestPaidToDate / summary.totalInterestLife) * 100 : 0

  // What-if prepayment (estimate from current combined state)
  const blendedRate = tracks.length
    ? tracks.reduce((s, t) => s + t.annual_rate * t.principal, 0) / tracks.reduce((s, t) => s + t.principal, 0)
    : 0
  function simulate(extraMonthly: number) {
    const r = blendedRate / 12
    let bal = mortgageBalance, months = 0, interestSum = 0
    const pay = monthlyMortgage
    while (bal > 0.5 && months < 1200 && pay > 0) {
      months++
      const interest = bal * r
      let principal = pay - interest + extraMonthly
      if (principal <= 0) break
      if (principal > bal) principal = bal
      bal -= principal
      interestSum += interest
    }
    return { months, interestSum, finished: bal <= 0.5 }
  }
  const baseSim = simulate(0)
  const whatifSim = simulate(extra)
  const monthsSaved = baseSim.months - whatifSim.months
  const interestSaved = baseSim.interestSum - whatifSim.interestSum
  const canWhatIf = tracks.length > 0 && blendedRate > 0 && baseSim.finished

  // Chart geometry
  const yearsTotal = combined.length ? Math.max(1, Math.round(combined.length / 12)) : 0
  const yearly = Array.from({ length: yearsTotal + 1 }, (_, y) => combined[Math.min(y * 12, combined.length - 1)]).filter(Boolean)
  const W = 300, H = 140, padX = 10, padTop = 12, padBot = 22
  const maxY = Math.max(...combined.map(r => Math.max(r.principal, r.interest)), 1)
  const xFor = (i: number) => padX + (i / Math.max(1, yearsTotal)) * (W - 2 * padX)
  const yFor = (v: number) => padTop + (1 - v / maxY) * (H - padTop - padBot)
  const linePts = (key: 'interest' | 'principal') => yearly.map((r, i) => `${xFor(i).toFixed(1)},${yFor(r[key]).toFixed(1)}`).join(' ')
  const principalArea = combined.length ? `${padX},${(H - padBot).toFixed(1)} ${linePts('principal')} ${xFor(yearly.length - 1).toFixed(1)},${(H - padBot).toFixed(1)}` : ''
  const hereYear = hereRow ? hereRow.monthIndex / 12 : 0
  const hereX = xFor(hereYear)
  const crossX = crossover ? xFor(crossover.monthIndex / 12) : 0

  const METRICS = [
    grossYield != null ? { id: 'gross', label: 'תשואה ברוטו', value: `${grossYield.toFixed(1)}%`, formula: `${fmt(monthlyRent * 12)} שכ״ד שנתי ÷ ${fmt(propertyValue)} שווי הנכס` } : null,
    totalInvested > 0 ? { id: 'roe', label: 'תשואה על ההון', value: `${(propertyValue > 0 && totalInvested > 0 ? (adjustedNet * 12 / totalInvested) * 100 : 0).toFixed(1)}%`, formula: `${fmt(adjustedNet * 12)} תזרים שנתי ÷ ${fmt(totalInvested)} שהושקע` } : null,
    rentReceived > 0 ? { id: 'collected', label: 'שכ״ד שנגבה', value: fmt(rentReceived), formula: 'סך שכר הדירה שנגבה עד היום' } : null,
  ].filter(Boolean) as { id: string; label: string; value: string; formula: string }[]

  return (
    <div className="page dmv">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1>ראשי</h1>
        <div className="dmv-toggle">
          <button className={mode === 'ops' ? 'on ops' : ''} onClick={() => setMode('ops')}>
            <ListChecks size={16} weight={mode === 'ops' ? 'fill' : 'regular'} /> תפעול
          </button>
          <button className={mode === 'inv' ? 'on inv' : ''} onClick={() => setMode('inv')}>
            <ChartLineUp size={16} weight={mode === 'inv' ? 'fill' : 'regular'} /> השקעה
          </button>
        </div>
      </div>

      {summaryLoading ? (
        <div className="dmv-hero"><Skeleton width="40%" height={14} /><Skeleton width="60%" height={32} /><Skeleton width="100%" height={12} radius={6} /></div>
      ) : !property ? (
        <EmptyState icon={<ClayIllustration variant="house" />} title="עדיין לא הוגדר נכס" actionLabel="הגדרת נכס" onAction={() => navigate('/property/details')} />
      ) : mode === 'ops' ? (
        <div className="dmv-view" key="ops">
          {/* Cashflow hero */}
          <div className="dmv-hero">
            <div className="dmv-hero-label">תזרים החודש</div>
            <div className={`dmv-hero-value ${adjustedNet >= 0 ? 'pos' : 'neg'}`}>{adjustedNet >= 0 ? '+' : '−'}{fmt(Math.abs(adjustedNet))}</div>
            {!flowLoading && (totalIncome > 0 || totalExpense > 0) && (
              <>
                <div className="dmv-flow-bar"><div className="seg-in" style={{ width: `${inPct}%` }} /><div className="seg-out" style={{ width: `${100 - inPct}%` }} /></div>
                <div className="dmv-flow-tiles">
                  <div className="dmv-flow-tile in"><span className="dmv-flow-tile-label"><ArrowDown size={13} weight="bold" /> נכנס</span><span className="dmv-flow-tile-value">{fmt(totalIncome)}</span></div>
                  <div className="dmv-flow-tile out"><span className="dmv-flow-tile-label"><ArrowUp size={13} weight="bold" /> יצא</span><span className="dmv-flow-tile-value">{fmt(totalExpense)}</span></div>
                </div>
              </>
            )}
          </div>

          {fixedExpenses > 0 && (
            <div className="dmv-fixed-row" onClick={() => setMode('inv')}>
              <div className="dmv-fixed-icon"><Coins size={22} weight="duotone" /></div>
              <div className="dmv-fixed-info"><div className="dmv-fixed-title">הוצאות קבועות חודשיות</div><div className="dmv-fixed-sub">משכנתא · ביטוח ועוד</div></div>
              <div className="dmv-fixed-amount">{fmt(fixedExpenses)}</div>
            </div>
          )}

          {/* Attention */}
          <section className="dmv-section">
            <div className="dmv-section-head"><h2>דורש תשומת לב</h2><button className="dmv-link" onClick={() => navigate('/tasks')}>הכל</button></div>
            {loadingStats ? (
              <Skeleton width="100%" height={60} radius={16} />
            ) : attentionItems.length === 0 ? (
              <div className="dmv-calm"><div className="dmv-calm-icon"><CheckCircle size={28} weight="fill" /></div><div className="dmv-calm-title">אין מה לעשות היום</div><div className="dmv-calm-sub">הנכס שלך עובד בשבילך.</div></div>
            ) : (
              attentionItems.map(item => (
                <div key={item.key} className={`dmv-att ${item.overdue ? 'overdue' : ''}`} onClick={item.onClick}>
                  <div className="dmv-att-glyph">{item.renewal ? <FileText size={19} /> : item.overdue ? <Warning size={19} weight="fill" /> : <CalendarCheck size={19} />}</div>
                  <div className="dmv-att-body">
                    <span className="dmv-att-title">{item.title}{item.renewal && <span className="dmv-badge renewal">חידוש</span>}{item.overdue && !item.renewal && <span className="dmv-badge danger">באיחור</span>}</span>
                    <span className="dmv-att-sub">{item.date ? formatDate(item.date) : ''}{item.daysLeft !== undefined ? ` · ${item.daysLeft} ימים` : ''}</span>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Recent transactions */}
          <section className="dmv-section">
            <div className="dmv-section-head"><h2>תנועות אחרונות</h2><button className="dmv-link" onClick={() => navigate('/finances')}>הכל</button></div>
            {recentLoading ? (
              <Skeleton width="100%" height={60} radius={16} />
            ) : recentItems.length === 0 ? (
              <EmptyState icon={<ClayIllustration variant="exchange" />} title="אין תנועות עדיין" actionLabel="הוסף תנועה" onAction={() => navigate('/finances', { state: { openForm: true } })} />
            ) : (
              recentItems.map(tx => (
                <div key={tx.id} className="dmv-tx" onClick={() => navigate('/finances')}>
                  <span className={`dmv-tx-tile ${tx.direction}`}>{tx.direction === 'income' ? <ArrowDownLeft size={17} weight="bold" /> : <ArrowUpRight size={17} weight="bold" />}</span>
                  <span className="dmv-tx-cat"><span className="dmv-tx-name">{tx.category}</span><span className="dmv-tx-date">{formatDate(tx.date)}</span></span>
                  <span className={`dmv-tx-amount ${tx.direction}`}>{tx.direction === 'income' ? '+' : '−'}{fmt(tx.amount)}</span>
                </div>
              ))
            )}
          </section>

          <div className="dmv-quick">
            <button className="btn-secondary" onClick={() => navigate('/finances', { state: { openForm: true } })}>+ תנועה</button>
            <button className="btn-secondary" onClick={() => navigate('/tasks')}>+ משימה</button>
          </div>
        </div>
      ) : (
        <div className="dmv-view" key="inv">
          {/* Equity hero */}
          <div className="dmv-hero">
            <div className="dmv-hero-label">ההון שלי בנכס</div>
            <div className="dmv-hero-value">{fmt(equity)}</div>
            <div className="dmv-eq-bar"><div className="own" style={{ width: `${barPct(equity)}%` }} /><div className="debt" style={{ width: `${barPct(totalDebt)}%` }} /></div>
            <div className="dmv-eq-legend">
              <span><i className="dmv-dot own" /> שווי נכס {fmt(propertyValue)}</span>
              {totalDebt > 0 && <span><i className="dmv-dot debt" /> חוב {fmt(totalDebt)}</span>}
            </div>
          </div>

          {METRICS.length > 0 && (
            <div className="dmv-metrics">
              {METRICS.map(m => (
                <button key={m.id} className={`dmv-metric${openMetric === m.id ? ' open' : ''}`} onClick={() => setOpenMetric(openMetric === m.id ? null : m.id)}>
                  <div className="dmv-metric-top"><span className="dmv-metric-label">{m.label}</span><CaretDown className="dmv-metric-caret" size={13} weight="bold" /></div>
                  <div className="dmv-metric-value">{m.value}</div>
                  <div className="dmv-metric-formula">{m.formula}</div>
                </button>
              ))}
            </div>
          )}

          {/* Principal vs interest */}
          {combined.length > 0 && hereRow && (
            <div className="dmv-card">
              <div className="dmv-card-head"><ChartPieSlice size={18} weight="duotone" /> קרן מול ריבית</div>
              <div className="dmv-card-text" style={{ marginBottom: 14 }}>החודש: מתוך {fmt(hereRow.payment)} — <b>{fmt(hereRow.principal)} הקטינו את החוב</b>, {fmt(hereRow.interest)} ריבית.</div>
              <div className="dmv-chart">
                <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="גרף קרן מול ריבית לאורך חיי המשכנתא">
                  <polygon points={principalArea} fill="var(--success-bg)" />
                  <polyline points={linePts('principal')} fill="none" stroke="var(--success)" strokeWidth="2" />
                  <polyline points={linePts('interest')} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
                  {crossover && (<><line x1={crossX} y1={padTop} x2={crossX} y2={H - padBot} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" /><circle cx={crossX} cy={yFor(crossover.principal)} r="3.5" fill="var(--accent)" /></>)}
                  <line x1={hereX} y1={padTop} x2={hereX} y2={H - padBot} stroke="var(--brand-navy)" strokeWidth="1" />
                  <circle cx={hereX} cy={yFor(hereRow.principal)} r="3" fill="var(--brand-navy)" />
                  <text x={hereX} y={H - 8} fontSize="9" fill="var(--brand-navy)" textAnchor="middle" fontWeight="600">אתה כאן</text>
                  <text x={padX} y={H - 8} fontSize="9" fill="var(--text-muted)" textAnchor="start">0</text>
                  <text x={W - padX} y={H - 8} fontSize="9" fill="var(--text-muted)" textAnchor="end">{yearsTotal} שנים</text>
                </svg>
              </div>
              <div className="dmv-chart-legend"><span><i className="dmv-dot" style={{ background: 'var(--success)' }} /> קרן (החוב שנמחק)</span><span><i className="dmv-dot" style={{ background: 'var(--border-strong)' }} /> ריבית (העלות)</span></div>
              {crossoverYear && <div className="dmv-crossover"><Flag size={16} weight="fill" /><span>נקודת ההיפוך: <b>שנה {crossoverYear}</b> — מכאן רוב התשלום בונה לך הון, לא ריבית.</span></div>}
            </div>
          )}

          {/* What-if */}
          {canWhatIf && (
            <div className="dmv-card">
              <div className="dmv-card-head"><Faders size={18} weight="duotone" /> מה אם אקדים תשלום לקרן?</div>
              <div className="dmv-whatif-row">
                <input type="range" min={0} max={3000} step={100} value={extra} onChange={e => setExtra(Number(e.target.value))} className="dmv-slider" />
                <span className="dmv-whatif-amount">{extra > 0 ? `+${fmt(extra)}` : fmt(0)}<small>/חודש</small></span>
              </div>
              {extra > 0 && whatifSim.finished ? (
                <div className="dmv-whatif-result">
                  <div className="dmv-whatif-stat"><MapPin size={15} weight="fill" /><span>תסיים <b>{(monthsSaved / 12).toFixed(1)} שנים מוקדם</b> ({whatifSim.months} חודשים בסה״כ)</span></div>
                  <div className="dmv-whatif-stat saved"><TrendUp size={15} weight="bold" /><span>תחסוך <b>{fmt(interestSaved)}</b> בריבית</span></div>
                </div>
              ) : (
                <div className="dmv-whatif-hint">הזז את הסליידר כדי לראות כמה שנים וכמה כסף תחסוך. (הערכה)</div>
              )}
            </div>
          )}

          {summary.interestPaidToDate > 0 && (
            <div className="dmv-insight"><TrendUp className="dmv-insight-icon" size={20} weight="bold" /><span className="dmv-insight-text">שילמת עד היום {fmt(summary.interestPaidToDate)} ריבית — {interestPaidPct.toFixed(0)}% מסך הריבית הצפויה.</span></div>
          )}
        </div>
      )}
    </div>
  )
}
