import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  CheckCircle, Coins, CalendarCheck, FileText, ArrowRight, ArrowLeft, Sun, CloudSun, MoonStars,
  Sparkle, Plus, ListPlus, CircleNotch, HandCoins, Check, GearSix, CaretDown, CaretLeft,
} from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import { useMortgageData } from '../../hooks/useMortgageData'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useLoansData } from '../../hooks/useLoansData'
import { useInsurance } from '../../hooks/useInsurance'
import { useTasks, updateTask } from '../../hooks/useTasks'
import { useTransactions, createTransaction } from '../../hooks/useTransactions'
import { formatCurrency, formatDate, todayISO } from '../../lib/format'
import { gracePeriodPayment } from '../../lib/mortgage'
import { activeContract as findActiveContract } from '../../lib/projections'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../../lib/constants'
import { parseQuick } from '../../lib/quickParse'
import { taskCompletionFollowup } from '../../lib/taskFollowup'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState, PageError } from '../../components/ui/EmptyState'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
import ExpenseSheet from '../../components/capture/ExpenseSheet'
import TaskSheet from '../../components/capture/TaskSheet'
import './home-screen.css'

const fmt = (v: number) => formatCurrency(v)

type Action =
  | { id: string; kind: 'rent'; title: string; sub: string; amount: number }
  | { id: string; kind: 'task'; title: string; sub: string; taskId: string }
  | { id: string; kind: 'renewal'; title: string; sub: string; onGo: () => void }

function greeting(name: string): { text: string; Icon: typeof Sun } {
  const h = new Date().getHours()
  if (h < 12) return { text: `בוקר טוב, ${name}`, Icon: Sun }
  if (h < 18) return { text: `צהריים טובים, ${name}`, Icon: CloudSun }
  return { text: `ערב טוב, ${name}`, Icon: MoonStars }
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { upcomingRenewals, loading: loadingStats, error } = useDashboardStats()
  const { summary, tracks, loading: loadingMortgage } = useMortgageData()
  const { property, contracts, utilities, loading: loadingProperty } = usePropertyData()
  const { summary: loansSummary, loading: loadingLoans } = useLoansData()
  const { policies, loading: loadingInsurance } = useInsurance()
  const { tasks, setTasks, loading: loadingTasks, refetch: refetchTasks } = useTasks({ status: 'open' })
  const { transactions, loading: loadingTx, refetch: refetchTx } = useTransactions({ year, month })

  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)
  const [quick, setQuick] = useState('')
  const [sheet, setSheet] = useState<null | 'expense' | 'task'>(null)
  const [sheetSeed, setSheetSeed] = useState('')
  const [extraOpen, setExtraOpen] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(false)

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'שלום'
  const { text: hello, Icon: HelloIcon } = greeting(firstName)

  const todayStr = todayISO()
  const rentCatSet = useMemo(() => new Set(RENT_CATEGORIES as readonly string[]), [])
  // Categories already represented in fixedExpenses (mortgage + insurance auto-post
  // as real transactions via the generator) — exclude them so they aren't counted twice.
  const fixedCatSet = useMemo(() => new Set([...MORTGAGE_CATEGORIES, 'ביטוח'] as string[]), [])

  // ── Fixed (expected) monthly expenses — calm, never red ──
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  const hasGrace = tracks.some(t => (t.grace_months ?? 0) > 0)
  const selectedMortgage = hasGrace ? gracePeriodPayment(tracks) : summary.monthlyPayment || 0
  const monthlyLoan = loansSummary.monthlyPayment || 0
  const monthlyInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)
  const activeContractId = activeContract?.id
  const monthlyOwnerUtilities = utilities
    .filter(u => u.payer === 'owner' && (u.amount ?? 0) > 0 && (!activeContractId || u.contract_id === activeContractId))
    .reduce((s, u) => s + (u.amount ?? 0), 0)
  const fixedExpenses = selectedMortgage + monthlyLoan + monthlyInsurance + monthlyOwnerUtilities

  // ── This month's reality ──
  const rentReceived = transactions
    .filter(t => t.direction === 'income' && rentCatSet.has(t.category))
    .reduce((s, t) => s + t.amount, 0)
  const extraTxs = transactions.filter(t => t.direction === 'expense' && !fixedCatSet.has(t.category))
  const extraExpenses = extraTxs.reduce((s, t) => s + t.amount, 0)
  // Actual income that isn't the monthly rent (one-off income added by hand).
  const extraIncomeTxs = transactions.filter(t => t.direction === 'income' && !rentCatSet.has(t.category))
  const extraIncome = extraIncomeTxs.reduce((s, t) => s + t.amount, 0)
  const rentCleared = monthlyRent > 0 && rentReceived >= monthlyRent
  const rentPct = monthlyRent > 0 ? Math.min(100, (rentReceived / monthlyRent) * 100) : 0
  // Forecast uses the greater of expected vs actual rent, plus any extra income,
  // so anything you add by hand is reflected in the bottom line.
  const expectedNet = Math.max(monthlyRent, rentReceived) + extraIncome - fixedExpenses - extraExpenses

  // ── Build the prioritized action list (rent → overdue tasks → renewals) ──
  const actions = useMemo<Action[]>(() => {
    const list: Action[] = []
    if (monthlyRent > 0 && !rentCleared) {
      list.push({
        id: 'rent',
        kind: 'rent',
        title: 'האם התקבל שכר הדירה החודש?',
        sub: `${activeContract?.company_name ?? 'הדייר'} · ${fmt(monthlyRent)}`,
        amount: monthlyRent - rentReceived,
      })
    }
    // All open tasks, smart-sorted: dated first (soonest/overdue on top), then undated
    // backlog — so nothing without a deadline gets forgotten. Only the top 2 render here.
    const sortedTasks = [...tasks].sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })
    sortedTasks
      .slice(0, 2)
      .forEach(t =>
        list.push({
          id: `task-${t.id}`,
          kind: 'task',
          title: t.title,
          sub: !t.due_date ? `ללא תאריך · ${t.category}`
            : t.due_date < todayStr ? `באיחור · ${formatDate(t.due_date)}`
            : t.due_date === todayStr ? 'להיום'
            : formatDate(t.due_date),
          taskId: t.id,
        })
      )
    upcomingRenewals
      .filter(r => r.daysLeft <= 45)
      .forEach(({ contract, daysLeft }) =>
        list.push({
          id: `renewal-${contract.id}`,
          kind: 'renewal',
          title: `חידוש חוזה — ${contract.company_name}`,
          sub: `נגמר בעוד ${daysLeft} ימים · ${formatDate(contract.end_date)}`,
          onGo: () => navigate('/property/rental'),
        })
      )
    // Rent (≤1) + renewals (rare) keep priority; tasks already bounded to 2 above.
    return list.filter(a => !done.has(a.id))
  }, [monthlyRent, rentCleared, rentReceived, activeContract, tasks, upcomingRenewals, done, todayStr, navigate])

  // How many open tasks aren't shown in the bounded top-2 — drives "+ עוד X משימות".
  const extraTaskCount = Math.max(0, tasks.length - 2)

  const loadingActions = loadingStats || loadingTasks || loadingTx || loadingProperty
  const loadingFlow = loadingProperty || loadingMortgage || loadingLoans || loadingInsurance || loadingTx

  async function approveRent(amount: number) {
    setBusy('rent')
    try {
      const { error } = await createTransaction({
        contract_id: activeContractId ?? null,
        recurring_item_id: null,
        document_id: null,
        direction: 'income',
        amount,
        date: todayStr,
        category: 'שכר דירה',
        description: 'שכר דירה — אושר מהמסך הראשי',
        payment_method: activeContract?.payment_method ?? null,
      })
      if (error) throw error
      setDone(prev => new Set(prev).add('rent'))
      setFlash('יופי! שכר הדירה נרשם ✓')
      await refetchTx()
    } catch {
      setFlash('לא הצלחנו לרשום, נסה שוב')
    } finally {
      setBusy(null)
      setTimeout(() => setFlash(null), 2600)
    }
  }

  function markTaskDone(id: string) {
    // Capture the task before the optimistic drop so we can offer the money
    // follow-up (record the repair expense / rent collection / payment).
    const task = tasks.find(t => t.id === id)
    // Optimistic pipeline: drop the task from the open pool immediately so the next
    // backlog task slides up into its slot and "+ עוד X משימות" decrements in real time.
    // Persist in the background; only reload if the write fails.
    setTasks(prev => prev.filter(t => t.id !== id))
    setFlash('משימה הושלמה ✓')
    setTimeout(() => setFlash(null), 2600)
    updateTask(id, { status: 'done' }).then(r => {
      if (r.error) { setFlash('לא הצלחנו לעדכן, נסה שוב'); refetchTasks() }
    })

    // Same follow-up the Tasks hub offers, deferred so the checkmark paints first.
    const followup = task ? taskCompletionFollowup(task) : null
    if (followup) {
      setTimeout(() => {
        if (confirm(followup.msg)) navigate('/finances', { state: { prefill: followup.prefill } })
      }, 80)
    }
  }

  function showFlash(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2600)
  }

  async function submitQuick(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseQuick(quick)
    // No amount detected → open the expense sheet pre-filled with the typed text.
    if (!parsed) {
      setSheetSeed(quick.trim())
      setSheet('expense')
      return
    }
    // AI "magic" path: classify + write inline, never leave the dashboard.
    const text = quick
    setQuick('')
    // Quick-typed income is always treated as one-off "extra income" — rent has its
    // own dedicated flow (the "שכר הדירה התקבל" action), so it never touches the rent line.
    const { error } = await createTransaction({
      contract_id: null,
      recurring_item_id: null, document_id: null,
      direction: parsed.income ? 'income' : 'expense',
      amount: parsed.amount, date: todayStr,
      category: 'אחר',
      description: parsed.desc, payment_method: null,
    })
    if (error) { setQuick(text); showFlash('לא הצלחנו לרשום, נסה שוב'); return }
    showFlash(`נרשם ✓ ${fmt(parsed.amount)} · ${parsed.desc}`)
    await refetchTx()
  }

  if (error) return <PageError message={error} />

  return (
    <div className="page hs">
      {/* ── Humanized status header ── */}
      <header className="hs-header">
        <Link to="/settings" className="hs-gear" aria-label="הגדרות"><GearSix size={22} /></Link>
        <div className="hs-greet">
          <span className="hs-greet-icon"><HelloIcon size={20} weight="fill" /></span>
          <h1>{hello}</h1>
        </div>
        {loadingActions ? (
          <Skeleton width="55%" height={15} />
        ) : (
          <p className="hs-status">
            {actions.length === 0
              ? 'הכול רגוע היום — אין מה לעשות עכשיו.'
              : actions.length === 1
                ? 'יש פעולה אחת שמחכה לך.'
                : `יש ${actions.length} פעולות שמחכות לך.`}
          </p>
        )}
      </header>

      {flash && <div className="hs-flash" role="status">{flash}</div>}

      {!property && !loadingProperty ? (
        <EmptyState
          icon={<ClayIllustration variant="house" />}
          title="עדיין לא הוגדר נכס"
          actionLabel="הגדרת נכס"
          onAction={() => navigate('/property/details')}
        />
      ) : (
        <>
          {/* ── Action Center ── */}
          <section className="hs-actions">
            {loadingActions ? (
              <Skeleton width="100%" height={78} radius={18} />
            ) : actions.length === 0 ? (
              <div className="hs-clear">
                <div className="hs-clear-icon"><CheckCircle size={30} weight="fill" /></div>
                <div>
                  <div className="hs-clear-title">הכול מטופל</div>
                  <div className="hs-clear-sub">הנכס עובד בשבילך. ניצור קשר כשמשהו ידרוש תשומת לב.</div>
                </div>
              </div>
            ) : (
              actions.map(a => {
                const isBusy = busy === a.id
                return (
                  <article key={a.id} className={`hs-card${done.has(a.id) ? ' resolved' : ''}`}>
                    <div className={`hs-card-icon ${a.kind}`}>
                      {a.kind === 'rent' ? <HandCoins size={22} weight="fill" />
                        : a.kind === 'renewal' ? <FileText size={20} weight="fill" />
                        : <CalendarCheck size={20} weight="fill" />}
                    </div>
                    <div className="hs-card-body">
                      <div className="hs-card-title">{a.title}</div>
                      <div className="hs-card-sub">{a.sub}</div>
                    </div>
                    <div className="hs-card-cta">
                      {a.kind === 'rent' ? (
                        <button className="hs-btn primary" disabled={isBusy} onClick={() => approveRent(a.amount)}>
                          {isBusy ? <CircleNotch className="spin" size={16} weight="bold" /> : <Check size={16} weight="bold" />}
                          כן, אשר
                        </button>
                      ) : a.kind === 'task' ? (
                        <button className="hs-btn ghost" disabled={isBusy} onClick={() => markTaskDone(a.taskId)}>
                          {isBusy ? <CircleNotch className="spin" size={16} weight="bold" /> : <Check size={16} weight="bold" />}
                          סיים
                        </button>
                      ) : (
                        <button className="hs-btn ghost" onClick={a.onGo}>
                          פתח <ArrowRight size={15} weight="bold" />
                        </button>
                      )}
                    </div>
                  </article>
                )
              })
            )}
            {extraTaskCount > 0 && (
              <button className="hs-more-tasks" onClick={() => navigate('/property/tasks')}>
                + עוד {extraTaskCount} {extraTaskCount === 1 ? 'משימה' : 'משימות'}
              </button>
            )}
          </section>

          {/* ── Quick capture ── */}
          <section className="hs-quick">
            <form className="hs-quick-input" onSubmit={submitQuick}>
              <Sparkle size={18} weight="fill" className="hs-quick-spark" />
              <input
                value={quick}
                onChange={e => setQuick(e.target.value)}
                placeholder="למשל: שילמתי 350 ₪ על תיקון ברז…"
                aria-label="הוספה מהירה בשפה חופשית"
              />
              <button type="submit" className="hs-quick-go" aria-label="הוסף">
                <ArrowLeft size={18} weight="bold" />
              </button>
            </form>
            <div className="hs-fabs">
              <button onClick={() => { setSheetSeed(''); setSheet('expense') }}>
                <Plus size={16} weight="bold" /> הוצאה
              </button>
              <button onClick={() => setSheet('task')}>
                <ListPlus size={16} weight="bold" /> משימה
              </button>
            </div>
          </section>

          {/* ── Calm cash flow ── */}
          <section className="hs-flow">
            <div className="hs-flow-head">
              <h2>תזרים החודש</h2>
              <button className="hs-link" onClick={() => navigate('/finances')}>פירוט</button>
            </div>
            {loadingFlow ? (
              <Skeleton width="100%" height={120} radius={18} />
            ) : (
              <div className="hs-flow-card">
                <div className="hs-flow-headline">
                  <span className="hs-flow-headline-label">צפי לסוף החודש</span>
                  <span className={`hs-flow-headline-value${expectedNet >= 0 ? '' : ' soft-neg'}`}>
                    {expectedNet >= 0 ? '+' : '−'}{fmt(Math.abs(expectedNet))}
                  </span>
                </div>

                {/* Rent — actual progress when leased; an invitation to add a
                    lease when not (no tenant = no income, the thing to fix). */}
                {activeContract ? (
                  <div className="hs-flow-line">
                    <div className="hs-flow-line-top">
                      <span className="hs-flow-name">
                        שכר דירה
                        {rentCleared && <span className="hs-chip ok"><Check size={11} weight="bold" /> התקבל</span>}
                      </span>
                      <span className="hs-flow-amt income">
                        {fmt(rentReceived)}<span className="hs-flow-of"> / {fmt(monthlyRent)}</span>
                      </span>
                    </div>
                    <div className="hs-track"><div className={`hs-track-fill${rentCleared ? ' ok' : ''}`} style={{ width: `${rentPct}%` }} /></div>
                  </div>
                ) : (
                  <button type="button" className="hs-addlease" onClick={() => navigate('/property/rental')}>
                    <span className="hs-addlease-icon"><HandCoins size={20} weight="duotone" /></span>
                    <span className="hs-addlease-text">
                      <span className="hs-addlease-title">אין חוזה שכירות פעיל</span>
                      <span className="hs-addlease-sub">הוסיפו שוכר כדי לעקוב אחרי ההכנסה החודשית</span>
                    </span>
                    <span className="hs-addlease-cta">הוסף חוזה <CaretLeft size={13} weight="bold" /></span>
                  </button>
                )}

                {/* Fixed expenses — neutral, tagged automatic, never red */}
                <div className="hs-flow-line">
                  <div className="hs-flow-line-top">
                    <span className="hs-flow-name">
                      <Coins size={15} weight="duotone" /> תשלומים קבועים
                      <span className="hs-chip auto">אוטומטי · הוצאה</span>
                    </span>
                    <span className="hs-flow-amt muted out">−{fmt(fixedExpenses)}</span>
                  </div>
                </div>

                {extraIncome > 0 && (
                  <div className="hs-flow-line">
                    <button className="hs-flow-line-top hs-flow-expand" onClick={() => setIncomeOpen(o => !o)} aria-expanded={incomeOpen}>
                      <span className="hs-flow-name">
                        הכנסות נוספות החודש
                        <CaretDown className={`hs-flow-caret${incomeOpen ? ' open' : ''}`} size={13} weight="bold" />
                      </span>
                      <span className="hs-flow-amt income">{fmt(extraIncome)}</span>
                    </button>
                    {incomeOpen && (
                      <div className="hs-flow-sublist">
                        {extraIncomeTxs.map(t => (
                          <div key={t.id} className="hs-flow-subrow">
                            <span className="hs-flow-subcat">{t.category}{t.description ? ` · ${t.description}` : ''}</span>
                            <span className="hs-flow-subamt income">{fmt(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {extraExpenses > 0 && (
                  <div className="hs-flow-line">
                    <button className="hs-flow-line-top hs-flow-expand" onClick={() => setExtraOpen(o => !o)} aria-expanded={extraOpen}>
                      <span className="hs-flow-name">
                        הוצאות נוספות החודש
                        <CaretDown className={`hs-flow-caret${extraOpen ? ' open' : ''}`} size={13} weight="bold" />
                      </span>
                      <span className="hs-flow-amt muted out">−{fmt(extraExpenses)}</span>
                    </button>
                    {extraOpen && (
                      <div className="hs-flow-sublist">
                        {extraTxs.map(t => (
                          <div key={t.id} className="hs-flow-subrow">
                            <span className="hs-flow-subcat">{t.category}{t.description ? ` · ${t.description}` : ''}</span>
                            <span className="hs-flow-subamt">−{fmt(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <p className="hs-flow-note">
                  {!activeContract
                    ? 'הצפי כולל רק את ההוצאות הקבועות. הוסיפו חוזה שכירות כדי לראות גם את ההכנסה.'
                    : rentCleared
                    ? 'שכר הדירה נכנס. התשלומים הקבועים יורדים אוטומטית — אין צורך לעשות דבר.'
                    : 'הסכום מבוסס על הצפי החודשי. הוא יתעדכן כששכר הדירה ייכנס בפועל.'}
                </p>
              </div>
            )}
          </section>
        </>
      )}

      <ExpenseSheet
        open={sheet === 'expense'}
        onClose={() => setSheet(null)}
        initialDesc={sheetSeed}
        onDone={async (label) => { showFlash(label); await refetchTx() }}
      />
      <TaskSheet
        open={sheet === 'task'}
        onClose={() => setSheet(null)}
        onDone={async (label) => { showFlash(label); await refetchTasks() }}
      />
    </div>
  )
}
