import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppReady } from '../../contexts/AppReadyContext'
import {
  CheckCircle, Coins, CalendarCheck, FileText, ArrowRight, ArrowLeft, Sun, CloudSun, MoonStars,
  Sparkle, Plus, ListPlus, CircleNotch, HandCoins, Check, CaretDown, CaretUp, CaretLeft, ArrowsClockwise,
} from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import { useMortgageData } from '../../hooks/useMortgageData'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useLoansData } from '../../hooks/useLoansData'
import { useInsurance } from '../../hooks/useInsurance'
import { useTasks, updateTask, spawnNextOccurrence } from '../../hooks/useTasks'
import { useTransactions, createTransaction } from '../../hooks/useTransactions'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatSignedCurrency, formatDate, todayISO } from '../../lib/format'
import { visibleHomeTasks, sortedHomeTasks, futureScheduledTasks } from '../../lib/homeTasks'
import { nextDueDate } from '../../lib/recurrence'
import { activeContract as findActiveContract, monthlyVirtualEntries } from '../../lib/projections'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES, RENEWAL_WINDOW_DAYS } from '../../lib/constants'
import { parseQuick, predictCategory } from '../../lib/quickParse'
import { taskCompletionFollowup, type TaskFollowup } from '../../lib/taskFollowup'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState, PageError } from '../../components/ui/EmptyState'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import ExpenseSheet from '../../components/capture/ExpenseSheet'
import TaskSheet from '../../components/capture/TaskSheet'
import './home-screen.css'

const fmt = (v: number) => formatCurrency(v)

type Action =
  | { id: string; kind: 'rent'; title: string; sub: string; amount: number }
  | { id: string; kind: 'task'; title: string; sub: string; taskId: string; recurring: boolean }
  | { id: string; kind: 'renewal'; title: string; sub: string; onGo: () => void }

function greeting(name: string): { text: string; Icon: typeof Sun } {
  const h = new Date().getHours()
  // B8: only append a name when we have a real display name — never an email prefix.
  const who = name ? `, ${name}` : ''
  if (h < 12) return { text: `בוקר טוב${who}`, Icon: Sun }
  if (h < 18) return { text: `צהריים טובים${who}`, Icon: CloudSun }
  return { text: `ערב טוב${who}`, Icon: MoonStars }
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { upcomingRenewals, loading: loadingStats, error, partial } = useDashboardStats()
  const { tracks, loading: loadingMortgage } = useMortgageData()
  const { property, contracts, loading: loadingProperty, error: propertyError, refetch: refetchProperty } = usePropertyData()
  const { loans, loading: loadingLoans } = useLoansData()
  const { policies, loading: loadingInsurance } = useInsurance()
  const { tasks, setTasks, loading: loadingTasks, refetch: refetchTasks } = useTasks({ status: 'open' })
  const { transactions, loading: loadingTx, error: txError, refetch: refetchTx } = useTransactions({ year, month })

  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)
  const [quick, setQuick] = useState('')
  const [sheet, setSheet] = useState<null | 'expense' | 'task'>(null)
  const [sheetSeed, setSheetSeed] = useState('')
  // V3: when the expense sheet is docked (minimized) and its launcher is tapped again,
  // `open` doesn't change — bumping this restores the sheet instead of a dead tap.
  const [expenseExpandKey, setExpenseExpandKey] = useState(0)
  const [extraOpen, setExtraOpen] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(false)
  // "+ עוד X משימות" expands the extra tasks in place rather than navigating away
  // to the tasks screen (owner: keep the home flow, just widen it here).
  const [tasksExpanded, setTasksExpanded] = useState(false)
  // Money follow-up after completing a money-implying task — shown as an in-app
  // dialog (not a native confirm), and only after the completion actually persisted.
  const [followup, setFollowup] = useState<TaskFollowup | null>(null)
  // Quick-capture asks to confirm before writing — a fast inline entry can hide a typo
  // (an extra zero turning ₪50 into ₪500) and there was no confirm/undo (audit).
  const [quickPending, setQuickPending] = useState<{ income: boolean; amount: number; desc: string; text: string } | null>(null)

  // B8: real display name only — no email prefix / technical username fallback.
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] || ''
  const { text: hello, Icon: HelloIcon } = greeting(firstName)

  const todayStr = todayISO()
  const rentCatSet = useMemo(() => new Set(RENT_CATEGORIES as readonly string[]), [])
  // Categories already represented in fixedExpenses — exclude them from the "extra"
  // (hand-recorded) actuals so they aren't counted twice (audit C8). Must mirror EVERY
  // component of fixedExpenses: mortgage + insurance + loan ('הלוואה') + owner utilities.
  const fixedCatSet = useMemo(() => new Set([...MORTGAGE_CATEGORIES, 'ביטוח', 'הלוואה'] as string[]), [])

  // ── Fixed (expected) monthly expenses — calm, never red ──
  const activeContract = findActiveContract(contracts)
  const monthlyRent = activeContract?.monthly_rent ?? 0
  // A5: derive the fixed forecast from the SAME source the Finances ledger uses
  // (monthlyVirtualEntries) — mortgage + loans (schedule-bounded, so grace / paid-off
  // tracks are correct) + insurance. This guarantees the "צפי לסוף החודש" here matches
  // the month total on the תזרים screen exactly, instead of two drifting calculations.
  const fYear = new Date().getFullYear()
  const fMonth = new Date().getMonth() + 1
  const fixedExpenses = useMemo(
    () => monthlyVirtualEntries(contracts, tracks, fYear, fMonth, loans, policies)
      .filter(e => e.direction === 'expense')
      .reduce((s, e) => s + e.amount, 0),
    [contracts, tracks, loans, policies, fYear, fMonth],
  )

  // ── This month's reality ──
  const rentReceived = transactions
    .filter(t => t.direction === 'income' && rentCatSet.has(t.category))
    .reduce((s, t) => s + t.amount, 0)
  const extraTxs = transactions.filter(t => t.direction === 'expense' && !fixedCatSet.has(t.category))
  const extraExpenses = extraTxs.reduce((s, t) => s + t.amount, 0)
  // Actual income that isn't the monthly rent (one-off income added by hand).
  const extraIncomeTxs = transactions.filter(t => t.direction === 'income' && !rentCatSet.has(t.category))
  const extraIncome = extraIncomeTxs.reduce((s, t) => s + t.amount, 0)
  // EDGE-14: compare with a half-shekel epsilon so float drift can't flip "cleared".
  const rentCleared = monthlyRent > 0 && rentReceived + 0.5 >= monthlyRent
  const rentPct = monthlyRent > 0 ? Math.min(100, (rentReceived / monthlyRent) * 100) : 0
  // Forecast uses the greater of expected vs actual rent, plus any extra income,
  // so anything you add by hand is reflected in the bottom line.
  const expectedNet = Math.max(monthlyRent, rentReceived) + extraIncome - fixedExpenses - extraExpenses

  // Collapsed, only near/overdue/undated tasks surface (future-dated ones stay out of
  // "what to do now" — issue #36). Expanding "+ עוד X משימות" reveals every open task
  // regardless of date, so nothing is truly lost from the home (owner request).
  const collapsedTasks = useMemo(() => visibleHomeTasks(tasks, todayStr), [tasks, todayStr])
  const allTasks = useMemo(() => sortedHomeTasks(tasks), [tasks])
  // How many tasks are scheduled for the future (beyond the lead window) — drives the
  // gentle "+N בעתיד" hint in the header, so the owner always sees at a glance that
  // something is queued ahead without it crowding "what to do now" (owner request).
  const futureTaskCount = useMemo(() => futureScheduledTasks(tasks, todayStr).length, [tasks, todayStr])
  const shownTasks = tasksExpanded ? allTasks : collapsedTasks.slice(0, 2)

  // ── Build the prioritized action list (rent → overdue tasks → renewals) ──
  const actions = useMemo<Action[]>(() => {
    const list: Action[] = []
    if (monthlyRent > 0 && !rentCleared) {
      list.push({
        id: 'rent',
        kind: 'rent',
        title: activeContract?.payment_method === 'check'
          ? 'האם הופקד צ׳ק שכר הדירה?'
          : 'האם התקבל שכר הדירה החודש?',
        sub: `${activeContract?.company_name ?? 'הדייר'} · ${fmt(monthlyRent)}`,
        amount: monthlyRent - rentReceived,
      })
    }
    shownTasks
      .forEach(t => {
        const tm = t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ''
        list.push({
          id: `task-${t.id}`,
          kind: 'task',
          title: t.title,
          sub: !t.due_date ? `ללא תאריך · ${t.category}`
            : t.due_date < todayStr ? `באיחור · ${formatDate(t.due_date)}${tm}`
            : t.due_date === todayStr ? `להיום${tm}`
            : `${formatDate(t.due_date)}${tm}`,
          taskId: t.id,
          recurring: !!t.is_recurring,
        })
      })
    upcomingRenewals
      .filter(r => r.daysLeft <= RENEWAL_WINDOW_DAYS)
      .forEach(({ contract, daysLeft }) =>
        list.push({
          id: `renewal-${contract.id}`,
          kind: 'renewal',
          title: `חידוש חוזה — ${contract.company_name}`,
          sub: `${daysLeft === 0 ? 'נגמר היום' : daysLeft === 1 ? 'נגמר מחר' : `נגמר בעוד ${daysLeft} ימים`} · ${formatDate(contract.end_date)}`,
          onGo: () => navigate('/property/rental'),
        })
      )
    // Rent (≤1) + renewals (rare) keep priority; tasks bounded to 2 unless expanded.
    return list.filter(a => !done.has(a.id))
  }, [monthlyRent, rentCleared, rentReceived, activeContract, shownTasks, upcomingRenewals, done, todayStr, navigate])

  // How many open tasks aren't shown yet — drives "+ עוד X משימות". Counts every open
  // task (including future-dated ones held back from the collapsed view), so expanding
  // reveals them all in place rather than leaving any stranded off the home.
  const shownTaskCount = actions.filter(a => a.kind === 'task').length
  const extraTaskCount = Math.max(0, allTasks.length - shownTaskCount)
  // How many tasks the *collapsed* view shows (capped at 2). Expanding beyond this
  // is what the "הצג פחות" collapse undoes — so offer it whenever expanding revealed
  // more than the collapsed view would (e.g. a lone future-dated task, where the
  // collapsed view holds back everything and shows 0).
  const collapsedTaskCount = Math.min(collapsedTasks.length, 2)

  const loadingActions = loadingStats || loadingTasks || loadingTx || loadingProperty
  const loadingFlow = loadingProperty || loadingMortgage || loadingLoans || loadingInsurance || loadingTx

  // Once every data source on the home is loaded, let the app reveal it (drops the
  // initial splash held by App). Errors still flip loading→false, so this won't hang.
  const { markReady } = useAppReady()
  const homeLoaded = !loadingStats && !loadingMortgage && !loadingProperty && !loadingLoans && !loadingInsurance && !loadingTasks && !loadingTx
  useEffect(() => { if (homeLoaded) markReady() }, [homeLoaded, markReady])

  async function approveRent(amount: number) {
    setBusy('rent')
    try {
      // V2: link the approval to the rent recurring-item, so the daily reminder's
      // "already recorded this month" check matches it and stops nagging. Best-effort —
      // approving must still work if the lookup fails (the link only silences the nag).
      let rentItemId: string | null = null
      try {
        const { data: rentItems } = await supabase
          .from('recurring_items')
          .select('id')
          .eq('direction', 'income')
          .in('category', RENT_CATEGORIES as unknown as string[])
          .lte('start_date', todayStr)
          .or(`end_date.is.null,end_date.gte.${todayStr}`)
          .limit(1)
        rentItemId = rentItems?.[0]?.id ?? null
      } catch { /* reminder-linkage only */ }
      const { error } = await createTransaction({
        contract_id: activeContract?.id ?? null,
        recurring_item_id: rentItemId,
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
      showFlash('יופי! שכר הדירה נרשם ✓')
      await refetchTx()
    } catch {
      showFlash('לא הצלחנו לרשום, נסו שוב')
    } finally {
      setBusy(null)
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
    // Recurrence-aware feedback: for a repeating task, say WHEN it comes back — so the
    // next occurrence appearing later reads as "scheduled again", not "my tick didn't take".
    const nextStr = task?.is_recurring ? nextDueDate(task.due_date, task.recurrence_days) : null
    showFlash(nextStr ? `בוצע ✓ · חוזר ${formatDate(nextStr)}` : 'משימה הושלמה ✓')
    updateTask(id, { status: 'done' }).then(async r => {
      if (r.error) { showFlash('לא הצלחנו לעדכן, נסו שוב'); refetchTasks(); return }
      // Completing a repeating task creates its next occurrence — but DON'T surface it in
      // the current view. An identical "סיים" card popping into the same slot the instant
      // you complete reads as "nothing happened / it's still here" (owner feedback). We
      // create it in the background for later; it appears on the next load, near its due
      // date. The "בוצע ✓ · חוזר <date>" flash already confirms the recurrence, so the
      // completion feels final instead of a no-op.
      if (task?.is_recurring) await spawnNextOccurrence(task)
      // C5: only offer the money follow-up once completion actually persisted — so an
      // offline/failed completion never navigates the user to log money for a task
      // that bounces back. In-app dialog, not a blocking native confirm().
      const f = task ? taskCompletionFollowup(task) : null
      if (f) setFollowup(f)
    }).catch(() => {
      // A thrown/rejected write (e.g. offline) would otherwise leave the task removed
      // from the UI though it was never saved, plus an unhandled rejection. Restore it.
      showFlash('לא הצלחנו לעדכן, נסו שוב')
      refetchTasks()
    })
  }

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showFlash(msg: string) {
    setFlash(msg)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 2600)
  }

  async function submitQuick(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseQuick(quick)
    // No amount detected → open the expense sheet pre-filled with the typed text.
    if (!parsed) {
      setSheetSeed(quick.trim())
      setSheet('expense')
      // Already open-but-docked → restore it (V3); the docked data is preserved.
      if (sheet === 'expense') setExpenseExpandKey(k => k + 1)
      return
    }
    // AI "magic" path: classify inline, but confirm the parsed amount before writing so
    // a typo (an extra zero turning ₪50 into ₪500) can't silently record a giant expense
    // (audit — quick-capture had no confirm/undo).
    setQuickPending({ income: parsed.income, amount: parsed.amount, desc: parsed.desc, text: quick })
  }

  async function confirmQuickWrite() {
    const p = quickPending
    if (!p) return
    setQuickPending(null)
    setQuick('')
    // Quick-typed income is always treated as one-off "extra income" — rent has its
    // own dedicated flow (the "שכר הדירה התקבל" action), so it never touches the rent line.
    const { error } = await createTransaction({
      contract_id: null,
      recurring_item_id: null, document_id: null,
      direction: p.income ? 'income' : 'expense',
      amount: p.amount, date: todayStr,
      // EDGE-19: classify expenses like the full sheet does instead of always 'אחר'
      // (e.g. "תיקון ברז 350" → תיקונים). One-off income stays 'אחר' (rent has its own flow).
      category: p.income ? 'אחר' : predictCategory(p.desc),
      description: p.desc, payment_method: null,
    })
    if (error) { setQuick(p.text); showFlash('לא הצלחנו לרשום, נסו שוב'); return }
    showFlash(`נרשם ✓ ${fmt(p.amount)} · ${p.desc}`)
    await refetchTx()
  }

  // Distinguish a failed FIRST load (no cache → empty) from a genuine empty state, so we
  // never render a false "שכ״ד לא התקבל" (→ a duplicate rent entry when the user approves)
  // or a false "לא הוגדר נכס" (→ a second property). A transient refetch keeps the cached
  // rows, so these only fire when we truly have nothing loaded — then show a retryable
  // error instead of a misleading zero/empty (audit: silent-fetch-failure cluster).
  const txFailedEmpty = !!txError && transactions.length === 0
  const propertyFailedEmpty = !!propertyError && !property

  if (error) return <PageError message={error} />
  if (propertyFailedEmpty) return <PageError message={propertyError!} onRetry={refetchProperty} />
  if (txFailedEmpty) return <PageError message={txError!} onRetry={refetchTx} />

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
        ) : (!property && !loadingProperty) ? (
          <p className="hs-status">הגדירו נכס כדי להתחיל.</p>
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

      {/* C7-B: a secondary query (contracts/tracks) failed — numbers may be partial.
          Soft, non-fatal note instead of silently computing on empty arrays. */}
      {partial && (
        <div className="data-partial-note" role="status">חלק מהנתונים לא נטענו — ייתכן שחלק מהמספרים חסרים.</div>
      )}

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
              // Nothing needs attention now. If scheduled (future-dated) tasks are held
              // back behind the pill, say so plainly instead of "everything's handled" —
              // otherwise the reassuring card hides that a task is waiting (owner: "I don't
              // see it"). The "+ עוד" pill below reveals them.
              extraTaskCount > 0 ? (
                <div className="hs-clear">
                  <div className="hs-clear-icon upcoming"><CalendarCheck size={28} weight="fill" /></div>
                  <div>
                    <div className="hs-clear-title">אין משימות להיום</div>
                    {/* The gentle "+N בעתיד" hint lives here, as the calm sub-line of the empty
                        state — instead of a header banner the owner didn't like (#47). No date,
                        no extra chrome: just a soft note that something is queued ahead. */}
                    <div className="hs-clear-sub">
                      {futureTaskCount === 1 ? 'עוד משימה אחת בעתיד' : `עוד ${futureTaskCount} משימות בעתיד`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hs-clear">
                  <div className="hs-clear-icon"><CheckCircle size={30} weight="fill" /></div>
                  <div>
                    <div className="hs-clear-title">הכול מטופל</div>
                    <div className="hs-clear-sub">הנכס עובד בשבילך. נתריע כשמשהו ידרוש תשומת לב.</div>
                  </div>
                </div>
              )
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
                      <div className="hs-card-sub">
                        {a.sub}
                        {a.kind === 'task' && a.recurring && (
                          <span className="hs-recur"><ArrowsClockwise size={11} weight="bold" /> חוזר</span>
                        )}
                      </div>
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
            {extraTaskCount > 0 ? (
              <button className="hs-more-tasks" onClick={() => setTasksExpanded(true)}>
                {shownTaskCount === 0 ? (
                  // Nothing is shown yet (all tasks are future-dated) — "+ עוד" ("+ more")
                  // would read oddly, so gently name the scheduled tasks the tap reveals.
                  // No date here — the owner found the spelled-out date busy and ugly (#47).
                  <>הצג {extraTaskCount === 1 ? 'משימה מתוזמנת' : `${extraTaskCount} משימות מתוזמנות`} <CaretDown size={13} weight="bold" /></>
                ) : (
                  <>+ עוד {extraTaskCount} {extraTaskCount === 1 ? 'משימה' : 'משימות'}</>
                )}
              </button>
            ) : tasksExpanded && shownTaskCount > collapsedTaskCount ? (
              <button className="hs-more-tasks collapse" onClick={() => setTasksExpanded(false)}>
                הצג פחות <CaretUp size={13} weight="bold" />
              </button>
            ) : null}
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
              <button onClick={() => {
                // Docked sheet + another tap = restore it (V3), preserving typed data.
                if (sheet === 'expense') { setExpenseExpandKey(k => k + 1); return }
                setSheetSeed(''); setSheet('expense')
              }}>
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
                    {formatSignedCurrency(expectedNet)}
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
                ) : propertyError ? (
                  // R16: a transient contracts-fetch error must not claim "אין חוזה
                  // שכירות פעיל" — that's a false statement about the user's data.
                  // (A failed load with NO cached property is caught by the PageError
                  // gate above; this covers error-with-cached-property renders.)
                  <div className="hs-addlease" role="alert" style={{ cursor: 'default' }}>
                    <span className="hs-addlease-text">
                      <span className="hs-addlease-title">לא הצלחנו לטעון את חוזה השכירות</span>
                      <span className="hs-addlease-sub">בדקו את החיבור ורעננו את המסך</span>
                    </span>
                  </div>
                ) : (
                  <button type="button" className="hs-addlease" onClick={() => navigate('/property/rental')}>
                    <span className="hs-addlease-icon"><HandCoins size={20} weight="duotone" /></span>
                    <span className="hs-addlease-text">
                      <span className="hs-addlease-title">אין חוזה שכירות פעיל</span>
                      <span className="hs-addlease-sub">הוסיפו שוכר כדי לעקוב אחרי ההכנסה החודשית</span>
                    </span>
                    <span className="hs-addlease-cta">הוסיפו חוזה <CaretLeft size={13} weight="bold" /></span>
                  </button>
                )}

                {/* Fixed expenses — neutral, tagged automatic, never red */}
                <div className="hs-flow-line">
                  <div className="hs-flow-line-top">
                    <span className="hs-flow-name">
                      <Coins size={15} weight="duotone" /> תשלומים קבועים
                      <span className="hs-chip auto">אוטומטי · הוצאה</span>
                    </span>
                    <span className="hs-flow-amt muted out">{formatSignedCurrency(-fixedExpenses)}</span>
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
                      <span className="hs-flow-amt muted out">{formatSignedCurrency(-extraExpenses)}</span>
                    </button>
                    {extraOpen && (
                      <div className="hs-flow-sublist">
                        {extraTxs.map(t => (
                          <div key={t.id} className="hs-flow-subrow">
                            <span className="hs-flow-subcat">{t.category}{t.description ? ` · ${t.description}` : ''}</span>
                            <span className="hs-flow-subamt">{formatSignedCurrency(-t.amount)}</span>
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
        expandKey={expenseExpandKey}
        onDone={async (label) => { showFlash(label); await refetchTx() }}
      />
      <TaskSheet
        open={sheet === 'task'}
        onClose={() => setSheet(null)}
        onDone={async (label) => { showFlash(label); await refetchTasks() }}
      />

      <ConfirmDialog
        open={!!followup}
        message={followup?.msg ?? ''}
        confirmLabel="כן, לרישום"
        cancelLabel="דלג"
        onConfirm={() => {
          if (followup) navigate('/finances', { state: { prefill: followup.prefill } })
          setFollowup(null)
        }}
        onCancel={() => setFollowup(null)}
      />

      <ConfirmDialog
        open={!!quickPending}
        title="לרשום את התנועה?"
        message={quickPending ? `${quickPending.income ? 'הכנסה' : 'הוצאה'} · ${fmt(quickPending.amount)} · ${quickPending.desc}` : ''}
        confirmLabel="רישום"
        cancelLabel="ביטול"
        onConfirm={confirmQuickWrite}
        onCancel={() => setQuickPending(null)}
      />
    </div>
  )
}
