import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle, Coins, CalendarCheck, FileText, ArrowRight, Sun, CloudSun, MoonStars,
  Sparkle, Plus, ListPlus, CircleNotch, HandCoins, Check,
} from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import { useMortgageData } from '../../hooks/useMortgageData'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useLoansData } from '../../hooks/useLoansData'
import { useInsurance } from '../../hooks/useInsurance'
import { useTasks, updateTask } from '../../hooks/useTasks'
import { useTransactions, createTransaction } from '../../hooks/useTransactions'
import { formatCurrency, formatDate } from '../../lib/format'
import { gracePeriodPayment } from '../../lib/mortgage'
import { activeContract as findActiveContract } from '../../lib/projections'
import { RENT_CATEGORIES } from '../../lib/constants'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState, PageError } from '../../components/ui/EmptyState'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
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

// Light natural-language parse: "שילמתי 350 ₪ על תיקון ברז" → {amount:350, desc:"תיקון ברז", income:false}
function parseQuick(raw: string): { amount: number; desc: string; income: boolean } | null {
  const text = raw.trim()
  if (!text) return null
  const numMatch = text.replace(/,/g, '').match(/\d+(\.\d+)?/)
  if (!numMatch) return null
  const amount = Number(numMatch[0])
  if (!amount) return null
  const income = /קיבלתי|התקבל|הכנס|נכנס/.test(text)
  const desc = text
    .replace(/\d+(\.\d+)?/, '')
    .replace(/[₪שח"']/g, '')
    .replace(/^\s*(שילמתי|קיבלתי|הוצאתי|עבור|על|בעבור)\s*/g, '')
    .replace(/\s+(עבור|על)\s+/g, ' ')
    .trim()
  return { amount, desc: desc || 'אחר', income }
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
  const { tasks, loading: loadingTasks, refetch: refetchTasks } = useTasks({ status: 'open' })
  const { transactions, loading: loadingTx, refetch: refetchTx } = useTransactions({ year, month })

  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)
  const [quick, setQuick] = useState('')

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'שלום'
  const { text: hello, Icon: HelloIcon } = greeting(firstName)

  const todayStr = now.toISOString().slice(0, 10)
  const rentCatSet = useMemo(() => new Set(RENT_CATEGORIES as readonly string[]), [])

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
  const extraExpenses = transactions
    .filter(t => t.direction === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const rentCleared = monthlyRent > 0 && rentReceived >= monthlyRent
  const rentPct = monthlyRent > 0 ? Math.min(100, (rentReceived / monthlyRent) * 100) : 0
  const expectedNet = monthlyRent - fixedExpenses - extraExpenses

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
    tasks
      .filter(t => t.due_date && t.due_date <= todayStr)
      .slice(0, 3)
      .forEach(t =>
        list.push({
          id: `task-${t.id}`,
          kind: 'task',
          title: t.title,
          sub: t.due_date && t.due_date < todayStr ? `באיחור · ${formatDate(t.due_date)}` : 'להיום',
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
    return list.filter(a => !done.has(a.id)).slice(0, 3)
  }, [monthlyRent, rentCleared, rentReceived, activeContract, tasks, upcomingRenewals, done, todayStr, navigate])

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

  async function markTaskDone(id: string) {
    setBusy(`task-${id}`)
    try {
      const { error } = await updateTask(id, { status: 'done' })
      if (error) throw error
      setDone(prev => new Set(prev).add(`task-${id}`))
      setFlash('משימה הושלמה ✓')
      await refetchTasks()
    } catch {
      setFlash('לא הצלחנו לעדכן, נסה שוב')
    } finally {
      setBusy(null)
      setTimeout(() => setFlash(null), 2600)
    }
  }

  function submitQuick(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseQuick(quick)
    if (!parsed) {
      navigate('/finances', { state: { openForm: true } })
      return
    }
    navigate('/finances', {
      state: {
        openForm: true,
        prefill: {
          amount: parsed.amount,
          direction: parsed.income ? 'income' : 'expense',
          category: 'אחר',
          description: parsed.desc,
          date: todayStr,
        },
      },
    })
    setQuick('')
  }

  if (error) return <PageError message={error} />

  return (
    <div className="page hs">
      {/* ── Humanized status header ── */}
      <header className="hs-header">
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
                <ArrowRight size={18} weight="bold" />
              </button>
            </form>
            <div className="hs-fabs">
              <button onClick={() => navigate('/finances', { state: { openForm: true } })}>
                <Plus size={16} weight="bold" /> הוצאה
              </button>
              <button onClick={() => navigate('/tasks', { state: { openForm: true } })}>
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

                {/* Rent — actual progress, calm green only when cleared */}
                <div className="hs-flow-line">
                  <div className="hs-flow-line-top">
                    <span className="hs-flow-name">
                      שכר דירה
                      {rentCleared && <span className="hs-chip ok"><Check size={11} weight="bold" /> התקבל</span>}
                    </span>
                    <span className="hs-flow-amt">
                      {fmt(rentReceived)}<span className="hs-flow-of"> / {fmt(monthlyRent)}</span>
                    </span>
                  </div>
                  <div className="hs-track"><div className={`hs-track-fill${rentCleared ? ' ok' : ''}`} style={{ width: `${rentPct}%` }} /></div>
                </div>

                {/* Fixed expenses — neutral, tagged automatic, never red */}
                <div className="hs-flow-line">
                  <div className="hs-flow-line-top">
                    <span className="hs-flow-name">
                      <Coins size={15} weight="duotone" /> תשלומים קבועים
                      <span className="hs-chip auto">אוטומטי</span>
                    </span>
                    <span className="hs-flow-amt muted">{fmt(fixedExpenses)}</span>
                  </div>
                </div>

                {extraExpenses > 0 && (
                  <div className="hs-flow-line">
                    <div className="hs-flow-line-top">
                      <span className="hs-flow-name">הוצאות נוספות החודש</span>
                      <span className="hs-flow-amt muted">{fmt(extraExpenses)}</span>
                    </div>
                  </div>
                )}

                <p className="hs-flow-note">
                  {rentCleared
                    ? 'שכר הדירה נכנס. התשלומים הקבועים יורדים אוטומטית — אין צורך לעשות דבר.'
                    : 'הסכום מבוסס על הצפי החודשי. הוא יתעדכן כששכר הדירה ייכנס בפועל.'}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
