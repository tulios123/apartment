import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Plus, X, CaretDown, CaretLeft, CaretRight, ArrowUp, ArrowDown,
  ArrowDownLeft, ArrowUpRight, PencilSimple, Receipt, ChartPie, ChartBar,
} from '@phosphor-icons/react'
import { useTransactions, createTransaction, updateTransaction, deleteTransaction } from '../../hooks/useTransactions'
import { usePropertyData } from '../../hooks/usePropertyData'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS, RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../../lib/constants'
import { monthlyVirtualEntries } from '../../lib/projections'
import type { VirtualEntry } from '../../lib/projections'
import { supabase } from '../../lib/supabase'
import { getReceiptSignedUrl } from '../../lib/storage'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency, formatDate, todayISO } from '../../lib/format'
import type { Transaction, Contract, MortgageTrack, Loan } from '../../types'
import { SkeletonList } from '../../components/ui/Skeleton'
import { PageError } from '../../components/ui/EmptyState'
import './finances-v2.css'

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const MONTH_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
const PALETTE = ['var(--accent)', 'var(--accent-coral)', 'var(--accent-teal)', 'var(--accent-2)', 'var(--warning)', 'var(--success)', 'var(--danger)']
const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.filter(p => p.value).map(p => [p.value, p.label]))
const fmt = (v: number) => formatCurrency(v)
const RENT = RENT_CATEGORIES as readonly string[]
const MORT = MORTGAGE_CATEGORIES as readonly string[]

type Dir = 'income' | 'expense'

const emptyForm ={ direction: 'expense' as Dir, amount: '', date: todayISO(), category: EXPENSE_CATEGORIES[0] as string, description: '', payment_method: '' }

type Prefill = { direction?: Dir; category?: string; description?: string; amount?: number }

export default function FinancesV2() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const today = new Date()
  const [view, setView] = useState<'month' | 'year' | 'range'>('month')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  // Custom range. Defaults to key-delivery → today once the property loads.
  const { property } = usePropertyData()
  const [rangeFrom, setRangeFrom] = useState(`${today.getFullYear() - 4}-01-01`)
  const [rangeTo, setRangeTo] = useState(todayISO())
  const [rangeTouched, setRangeTouched] = useState(false)
  useEffect(() => {
    if (rangeTouched || !property) return
    const start = property.key_delivery_date ?? property.purchase_date
    if (start) setRangeFrom(start)
  }, [property, rangeTouched])

  const { transactions, loading, error, refetch } = useTransactions(
    view === 'month' ? { year, month } : view === 'year' ? { year } : { from: rangeFrom, to: rangeTo }
  )

  const [contracts, setContracts] = useState<Contract[]>([])
  const [mortgageTracks, setMortgageTracks] = useState<MortgageTrack[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('contracts').select('*').eq('owner_id', user.id),
      supabase.from('mortgage_tracks').select('*').eq('owner_id', user.id),
      supabase.from('loans').select('*').eq('owner_id', user.id),
    ]).then(([c, t, l]) => { setContracts((c.data ?? []) as Contract[]); setMortgageTracks((t.data ?? []) as MortgageTrack[]); setLoans((l.data ?? []) as Loan[]) })
  }, [user?.id])

  const virtualEntries = useMemo<VirtualEntry[]>(() => monthlyVirtualEntries(contracts, mortgageTracks, year, month, loans), [year, month, contracts, mortgageTracks, loans])

  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null)
  const swipeStart = useRef<{ x: number; y: number; horiz: boolean } | null>(null)

  // Open the form pre-filled when navigated here with a prefill (e.g. from a
  // completed repair/rent task). Clear the history state so it fires only once.
  useEffect(() => {
    const pf = (location.state as { prefill?: Prefill } | null)?.prefill
    if (!pf) return
    const direction: Dir = pf.direction ?? 'expense'
    const validCats = (direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES) as readonly string[]
    setForm({
      ...emptyForm,
      direction,
      category: pf.category && validCats.includes(pf.category) ? pf.category : validCats[0],
      description: pf.description ?? '',
      amount: pf.amount != null ? String(pf.amount) : '',
    })
    setEditingId(null)
    setFormError(null)
    setDrawerOpen(true)
    navigate(location.pathname, { replace: true })
  }, [location.state, location.pathname, navigate])

  // ── Month-scoped figures (used when view === 'month') ──────────────
  const realRentExists = transactions.some(t => t.direction === 'income' && RENT.includes(t.category))
  const realMortgageExists = transactions.some(t => t.direction === 'expense' && MORT.includes(t.category))
  const shownVirtual = virtualEntries.filter(e => {
    if (e.direction === 'income' && RENT.includes(e.category) && realRentExists) return false
    if (e.direction === 'expense' && MORT.includes(e.category) && realMortgageExists) return false
    return true
  })

  const mIncome = transactions.filter(t => t.direction === 'income').reduce((s, t) => s + Number(t.amount), 0) + shownVirtual.filter(e => e.direction === 'income').reduce((s, e) => s + e.amount, 0)
  const mExpense = transactions.filter(t => t.direction === 'expense').reduce((s, t) => s + Number(t.amount), 0) + shownVirtual.filter(e => e.direction === 'expense').reduce((s, e) => s + e.amount, 0)

  const monthBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter(t => t.direction === 'expense').forEach(t => map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount)))
    shownVirtual.filter(e => e.direction === 'expense').forEach(e => map.set(e.category, (map.get(e.category) ?? 0) + e.amount))
    return mapToBreakdown(map)
  }, [transactions, shownVirtual])

  // ── Year-scoped figures (used when view === 'year') ────────────────
  // Per-month aggregation of the whole year's transactions + forecast,
  // de-duplicating forecast rent/mortgage where a real entry exists that month.
  const monthly = useMemo(() => {
    if (view !== 'year') return []
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const mtx = transactions.filter(t => Number(t.date.slice(5, 7)) === m)
      const v = monthlyVirtualEntries(contracts, mortgageTracks, year, m, loans)
      const rRent = mtx.some(t => t.direction === 'income' && RENT.includes(t.category))
      const rMort = mtx.some(t => t.direction === 'expense' && MORT.includes(t.category))
      const sv = v.filter(e => {
        if (e.direction === 'income' && RENT.includes(e.category) && rRent) return false
        if (e.direction === 'expense' && MORT.includes(e.category) && rMort) return false
        return true
      })
      const income = mtx.filter(t => t.direction === 'income').reduce((s, t) => s + Number(t.amount), 0) + sv.filter(e => e.direction === 'income').reduce((s, e) => s + e.amount, 0)
      const expense = mtx.filter(t => t.direction === 'expense').reduce((s, t) => s + Number(t.amount), 0) + sv.filter(e => e.direction === 'expense').reduce((s, e) => s + e.amount, 0)
      return { month: m, income, expense, net: income - expense, sv, mtx }
    })
  }, [view, transactions, contracts, mortgageTracks, loans, year])

  const yearTotals = useMemo(() => {
    const income = monthly.reduce((s, r) => s + r.income, 0)
    const expense = monthly.reduce((s, r) => s + r.expense, 0)
    return { income, expense, net: income - expense }
  }, [monthly])

  const yearBreakdown = useMemo(() => {
    if (view !== 'year') return []
    const map = new Map<string, number>()
    monthly.forEach(r => {
      r.mtx.filter(t => t.direction === 'expense').forEach(t => map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount)))
      r.sv.filter(e => e.direction === 'expense').forEach(e => map.set(e.category, (map.get(e.category) ?? 0) + e.amount))
    })
    return mapToBreakdown(map)
  }, [view, monthly])

  const maxBar = Math.max(1, ...monthly.map(r => Math.max(r.income, r.expense)))
  const bestMonth = monthly.length ? monthly.reduce((a, b) => (b.net > a.net ? b : a)) : null

  // ── Range-scoped figures (used when view === 'range') ──────────────
  // Same per-month engine as the year view, but across an arbitrary span.
  const rangeMonthly = useMemo(() => {
    if (view !== 'range') return []
    return periodsBetween(rangeFrom, rangeTo).map(({ year: y, month: m }) => {
      const mtx = transactions.filter(t => Number(t.date.slice(0, 4)) === y && Number(t.date.slice(5, 7)) === m)
      const v = monthlyVirtualEntries(contracts, mortgageTracks, y, m, loans)
      const rRent = mtx.some(t => t.direction === 'income' && RENT.includes(t.category))
      const rMort = mtx.some(t => t.direction === 'expense' && MORT.includes(t.category))
      const sv = v.filter(e => {
        if (e.direction === 'income' && RENT.includes(e.category) && rRent) return false
        if (e.direction === 'expense' && MORT.includes(e.category) && rMort) return false
        return true
      })
      const income = mtx.filter(t => t.direction === 'income').reduce((s, t) => s + Number(t.amount), 0) + sv.filter(e => e.direction === 'income').reduce((s, e) => s + e.amount, 0)
      const expense = mtx.filter(t => t.direction === 'expense').reduce((s, t) => s + Number(t.amount), 0) + sv.filter(e => e.direction === 'expense').reduce((s, e) => s + e.amount, 0)
      return { year: y, month: m, income, expense, net: income - expense, sv, mtx }
    })
  }, [view, rangeFrom, rangeTo, transactions, contracts, mortgageTracks, loans])

  const rangeTotals = useMemo(() => {
    const income = rangeMonthly.reduce((s, r) => s + r.income, 0)
    const expense = rangeMonthly.reduce((s, r) => s + r.expense, 0)
    return { income, expense, net: income - expense }
  }, [rangeMonthly])

  const rangeBreakdown = useMemo(() => {
    if (view !== 'range') return []
    const map = new Map<string, number>()
    rangeMonthly.forEach(r => {
      r.mtx.filter(t => t.direction === 'expense').forEach(t => map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount)))
      r.sv.filter(e => e.direction === 'expense').forEach(e => map.set(e.category, (map.get(e.category) ?? 0) + e.amount))
    })
    return mapToBreakdown(map)
  }, [view, rangeMonthly])

  // Bars: a column per month when the span is short, otherwise per calendar year.
  const rangeByYear = rangeMonthly.length > 18
  const rangeBuckets = useMemo(() => {
    if (!rangeByYear) {
      return rangeMonthly.map(r => ({
        key: `${r.year}-${r.month}`, year: r.year, month: r.month,
        label: r.month === 1 || rangeMonthly[0] === r ? `${MONTH_SHORT[r.month - 1]} '${String(r.year).slice(2)}` : MONTH_SHORT[r.month - 1],
        income: r.income, expense: r.expense, net: r.net,
      }))
    }
    const byYear = new Map<number, { income: number; expense: number }>()
    rangeMonthly.forEach(r => {
      const cur = byYear.get(r.year) ?? { income: 0, expense: 0 }
      cur.income += r.income; cur.expense += r.expense
      byYear.set(r.year, cur)
    })
    return Array.from(byYear.entries()).map(([y, v]) => ({
      key: String(y), year: y, month: null as number | null,
      label: String(y), income: v.income, expense: v.expense, net: v.income - v.expense,
    }))
  }, [rangeMonthly, rangeByYear])

  const rangeMaxBar = Math.max(1, ...rangeBuckets.map(b => Math.max(b.income, b.expense)))

  // ── Displayed figures (mode-aware) ─────────────────────────────────
  const income = view === 'month' ? mIncome : view === 'year' ? yearTotals.income : rangeTotals.income
  const expense = view === 'month' ? mExpense : view === 'year' ? yearTotals.expense : rangeTotals.expense
  const net = income - expense
  const inPct = income + expense > 0 ? (income / (income + expense)) * 100 : 50
  const breakdown = view === 'month' ? monthBreakdown : view === 'year' ? yearBreakdown : rangeBreakdown

  function openNew() { setForm(emptyForm); setEditingId(null); setFormError(null); setDrawerOpen(true) }
  function openEdit(t: Transaction) {
    setForm({ direction: t.direction, amount: String(t.amount), date: t.date, category: t.category, description: t.description ?? '', payment_method: t.payment_method ?? '' })
    setEditingId(t.id); setFormError(null); setDrawerOpen(true)
  }
  function setDir(dir: Dir) { setForm(f => ({ ...f, direction: dir, category: dir === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] })) }

  async function submitForm() {
    if (!form.amount || Number(form.amount) <= 0) { setFormError('יש להזין סכום תקין'); return }
    setSaving(true); setFormError(null)
    try {
      const payload: Partial<Transaction> = {
        direction: form.direction, amount: Number(form.amount), date: form.date, category: form.category,
        description: form.description || null, payment_method: form.payment_method || null, contract_id: null, recurring_item_id: null,
      }
      if (editingId) { const { error } = await updateTransaction(editingId, payload); if (error) throw new Error(error.message) }
      else { const { error } = await createTransaction(payload as Omit<Transaction, 'id' | 'owner_id' | 'created_at'>); if (error) throw new Error(error.message) }
      setDrawerOpen(false); refetch()
    } catch (e) { setFormError(e instanceof Error ? e.message : 'שגיאה בשמירה') }
    setSaving(false)
  }

  async function handleDelete(id: string) { await deleteTransaction(id); setSwipe(null); refetch() }

  // Swipe gestures on a transaction row: left → delete, right → edit.
  function onTxTouchStart(e: React.TouchEvent, _id: string) {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horiz: false }
  }
  function onTxTouchMove(e: React.TouchEvent, id: string) {
    const s = swipeStart.current
    if (!s) return
    const dx = e.touches[0].clientX - s.x
    const dy = e.touches[0].clientY - s.y
    if (!s.horiz) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.horiz = true
      else if (Math.abs(dy) > 8) { swipeStart.current = null; setSwipe(null); return }
      else return
    }
    setSwipe({ id, dx: Math.max(-130, Math.min(130, dx)) })
  }
  function onTxTouchEnd(id: string) {
    const dx = swipe && swipe.id === id ? swipe.dx : 0
    swipeStart.current = null
    setSwipe(null)
    if (dx <= -90) handleDelete(id)
    else if (dx >= 90) { const t = transactions.find(x => x.id === id); if (t) openEdit(t) }
  }
  async function openReceipt(t: Transaction) {
    if (!t.document_id) return
    const { data } = await supabase.from('documents').select('storage_path').eq('id', t.document_id).single()
    if (!data) return
    window.open(await getReceiptSignedUrl(data.storage_path), '_blank')
  }

  function shiftPeriod(delta: number) {
    if (view === 'year') { setYear(y => y + delta); return }
    let m = month + delta, y = year
    if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  function drillToMonth(m: number) { setMonth(m); setView('month') }
  function drillToBucket(b: { year: number; month: number | null }) {
    setYear(b.year)
    if (b.month != null) { setMonth(b.month); setView('month') } else { setView('year') }
  }

  const categories = form.direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const colorFor = (cat: string) => { const b = breakdown.find(x => x.cat === cat); return b ? b.color : 'var(--text-muted)' }

  if (error) return <PageError message={error} onRetry={refetch} />

  return (
    <div className="finv">
      <div className="finv-periodbar">
        <div className="finv-viewtoggle">
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>חודש</button>
          <button className={view === 'year' ? 'on' : ''} onClick={() => setView('year')}>שנה</button>
          <button className={view === 'range' ? 'on' : ''} onClick={() => setView('range')}>טווח</button>
        </div>
        {view !== 'range' && (
          <div className="finv-monthnav">
            <button className="finv-monthnav-btn" onClick={() => shiftPeriod(-1)} aria-label={view === 'year' ? 'שנה קודמת' : 'חודש קודם'}><CaretRight size={18} weight="bold" /></button>
            <span className="finv-monthnav-label">{view === 'month' ? `${MONTH_NAMES[month - 1]} ${year}` : year}</span>
            <button className="finv-monthnav-btn" onClick={() => shiftPeriod(1)} aria-label={view === 'year' ? 'שנה הבאה' : 'חודש הבא'}><CaretLeft size={18} weight="bold" /></button>
          </div>
        )}
      </div>

      {view === 'range' && (
        <div className="finv-rangebar">
          <label className="finv-range-field"><span>מ־</span><input type="date" value={rangeFrom} max={rangeTo} onChange={e => { setRangeTouched(true); setRangeFrom(e.target.value) }} /></label>
          <label className="finv-range-field"><span>עד</span><input type="date" value={rangeTo} min={rangeFrom} max={todayISO()} onChange={e => { setRangeTouched(true); setRangeTo(e.target.value) }} /></label>
          {(property?.key_delivery_date || property?.purchase_date) && (
            <button className="finv-range-preset" onClick={() => { const start = property?.key_delivery_date ?? property?.purchase_date; if (!start) return; setRangeTouched(true); setRangeFrom(start); setRangeTo(todayISO()) }}>
              מקבלת מפתח
            </button>
          )}
        </div>
      )}

      <div className="finv-summary">
        <div className="finv-summary-label">{view === 'month' ? 'מאזן החודש' : view === 'year' ? 'מאזן השנה' : 'מאזן התקופה'}</div>
        <div className={`finv-summary-net ${net >= 0 ? 'pos' : 'neg'}`}>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}</div>
        <div className="finv-summary-bar"><div className="in" style={{ width: `${inPct}%` }} /><div className="out" style={{ width: `${100 - inPct}%` }} /></div>
        <div className="finv-summary-tiles">
          <div className="finv-summary-tile in"><span className="finv-summary-tile-label"><ArrowDown size={13} weight="bold" /> הכנסות</span><span className="finv-summary-tile-value">{fmt(income)}</span></div>
          <div className="finv-summary-tile out"><span className="finv-summary-tile-label"><ArrowUp size={13} weight="bold" /> הוצאות</span><span className="finv-summary-tile-value">{fmt(expense)}</span></div>
        </div>
      </div>

      <button className="finv-addbtn" onClick={openNew}>
        <Plus size={19} weight="bold" /> הוספת תנועה
      </button>

      {/* ── Annual perspective: 12-month bar chart ───────────────────── */}
      {view === 'year' && (
        loading ? <SkeletonList rows={3} /> : (
          <div className="finv-yearchart">
            <div className="finv-yearchart-head">
              <h3><ChartBar size={17} weight="duotone" /> סקירה חודשית · {year}</h3>
              <div className="finv-yearchart-legend">
                <span><i className="in" /> הכנסות</span>
                <span><i className="out" /> הוצאות</span>
              </div>
            </div>
            <div className="finv-yearbars">
              {monthly.map(r => {
                const isCurrent = year === today.getFullYear() && r.month === today.getMonth() + 1
                return (
                  <button key={r.month} className={`finv-yearbar-col${isCurrent ? ' current' : ''}`} onClick={() => drillToMonth(r.month)}
                    title={`${MONTH_NAMES[r.month - 1]} · הכנסות ${fmt(r.income)} · הוצאות ${fmt(r.expense)} · מאזן ${r.net >= 0 ? '+' : '−'}${fmt(Math.abs(r.net))}`}>
                    <div className="finv-yearbar-stack">
                      <div className="finv-yearbar in" style={{ height: `${(r.income / maxBar) * 100}%` }} />
                      <div className="finv-yearbar out" style={{ height: `${(r.expense / maxBar) * 100}%` }} />
                    </div>
                    <span className="finv-yearbar-label">{MONTH_SHORT[r.month - 1]}</span>
                  </button>
                )
              })}
            </div>
            {bestMonth && (bestMonth.income > 0 || bestMonth.expense > 0) && (
              <div className="finv-yearchart-foot">
                <span>החודש החזק: <strong>{MONTH_NAMES[bestMonth.month - 1]}</strong> ({bestMonth.net >= 0 ? '+' : '−'}{fmt(Math.abs(bestMonth.net))})</span>
                <span className="finv-yearchart-hint">לחץ על חודש לפירוט</span>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Range perspective: bar per month (short span) or per year ── */}
      {view === 'range' && (
        loading ? <SkeletonList rows={3} /> : rangeBuckets.length === 0 ? (
          <div className="finv-empty"><p style={{ color: 'var(--text-muted)' }}>בחר טווח תאריכים תקין</p></div>
        ) : (
          <div className="finv-yearchart">
            <div className="finv-yearchart-head">
              <h3><ChartBar size={17} weight="duotone" /> סקירה {rangeByYear ? 'שנתית' : 'חודשית'} · {formatDate(rangeFrom)}–{formatDate(rangeTo)}</h3>
              <div className="finv-yearchart-legend">
                <span><i className="in" /> הכנסות</span>
                <span><i className="out" /> הוצאות</span>
              </div>
            </div>
            <div className="finv-yearbars">
              {rangeBuckets.map(b => (
                <button key={b.key} className="finv-yearbar-col" onClick={() => drillToBucket(b)}
                  title={`${b.label} · הכנסות ${fmt(b.income)} · הוצאות ${fmt(b.expense)} · מאזן ${b.net >= 0 ? '+' : '−'}${fmt(Math.abs(b.net))}`}>
                  <div className="finv-yearbar-stack">
                    <div className="finv-yearbar in" style={{ height: `${(b.income / rangeMaxBar) * 100}%` }} />
                    <div className="finv-yearbar out" style={{ height: `${(b.expense / rangeMaxBar) * 100}%` }} />
                  </div>
                  <span className="finv-yearbar-label">{b.label}</span>
                </button>
              ))}
            </div>
            <div className="finv-yearchart-foot">
              <span>סך התקופה: <strong>{rangeTotals.net >= 0 ? '+' : '−'}{fmt(Math.abs(rangeTotals.net))}</strong> על פני {rangeMonthly.length} חודשים</span>
              <span className="finv-yearchart-hint">לחץ על עמודה לפירוט</span>
            </div>
          </div>
        )
      )}

      {expense > 0 && breakdown.length > 0 && (
        <div className={`finv-breakdown ${breakdownOpen ? 'open' : ''}`}>
          <button className="finv-breakdown-head" onClick={() => setBreakdownOpen(o => !o)}>
            <h3><ChartPie size={17} weight="duotone" /> פילוח הוצאות לפי קטגוריה{view === 'year' ? ' · שנתי' : view === 'range' ? ' · בטווח' : ''}</h3>
            <CaretDown className="finv-breakdown-caret" size={15} weight="bold" />
          </button>
          <div className="finv-breakdown-body"><div className="finv-breakdown-inner">
            {breakdown.map(b => (
              <div key={b.cat} className="finv-bd-row">
                <span className="finv-bd-label"><i style={{ width: 9, height: 9, borderRadius: 3, background: b.color, display: 'inline-block', flexShrink: 0 }} /> {b.cat}</span>
                <span className="finv-bd-track"><span className="finv-bd-fill" style={{ width: `${b.pct}%`, background: b.color }} /></span>
                <span className="finv-bd-amount">{fmt(b.amount)}</span>
              </div>
            ))}
          </div></div>
        </div>
      )}

      {/* ── Transaction list (month view only) ───────────────────────── */}
      {view === 'month' && (
        <>
          <div className="finv-section-head">
            <h2>תנועות</h2>
            {shownVirtual.length > 0 && <span className="finv-legend">מקווקו = תחזית מהחוזה/משכנתא</span>}
          </div>

          {loading ? (
            <SkeletonList rows={5} />
          ) : transactions.length === 0 && shownVirtual.length === 0 ? (
            <div className="finv-empty"><p style={{ color: 'var(--text-muted)' }}>אין תנועות בחודש זה</p></div>
          ) : (
            <>
              {shownVirtual.map(e => (
                <div key={e.id} className="finv-tx projected">
                  <span className="finv-cat-icon" style={{ background: colorFor(e.category) }}>{e.direction === 'income' ? <ArrowDownLeft size={20} weight="bold" /> : <ArrowUpRight size={20} weight="bold" />}</span>
                  <div className="finv-tx-body"><div className="finv-tx-top"><span className="finv-tx-cat">{e.category}</span><span className="finv-tx-tag">תחזית</span></div><span className="finv-tx-meta">{formatDate(e.date)}{e.description ? ` · ${e.description}` : ''}</span></div>
                  <div className="finv-tx-side"><span className={`finv-tx-amount ${e.direction}`}>{e.direction === 'income' ? '+' : '−'}{fmt(e.amount)}</span></div>
                </div>
              ))}
              {transactions.map(t => {
                const meta = [t.description, t.payment_method ? PAYMENT_LABEL[t.payment_method] : null].filter(Boolean).join(' · ')
                const dx = swipe?.id === t.id ? swipe.dx : 0
                const hint = dx <= -40 ? 'del' : dx >= 40 ? 'edit' : ''
                return (
                  <div key={t.id} className={`finv-tx swipeable${hint ? ` swipe-${hint}` : ''}`}
                    style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : undefined }}
                    onTouchStart={e => onTxTouchStart(e, t.id)}
                    onTouchMove={e => onTxTouchMove(e, t.id)}
                    onTouchEnd={() => onTxTouchEnd(t.id)}>
                    <span className="finv-cat-icon" style={{ background: colorFor(t.category) || 'var(--text-muted)' }}>{t.direction === 'income' ? <ArrowDownLeft size={20} weight="bold" /> : <ArrowUpRight size={20} weight="bold" />}</span>
                    <div className="finv-tx-body"><div className="finv-tx-top"><span className="finv-tx-cat">{t.category}</span></div><span className="finv-tx-meta">{formatDate(t.date)}{meta ? ` · ${meta}` : ''}</span></div>
                    <div className="finv-tx-side">
                      <span className={`finv-tx-amount ${t.direction}`}>{t.direction === 'income' ? '+' : '−'}{fmt(Number(t.amount))}</span>
                      <div className="finv-tx-actions">
                        {t.document_id && <button className="finv-icon-btn" aria-label="קבלה" onClick={() => openReceipt(t)}><Receipt size={15} /></button>}
                        <button className="finv-icon-btn" aria-label="עריכה" onClick={() => openEdit(t)}><PencilSimple size={15} /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      <button className="finv-fab" onClick={openNew} aria-label="הוסף תנועה"><Plus size={26} weight="bold" /></button>

      <div className={`finv-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`finv-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="finv-drawer-head"><h2>{editingId ? 'עריכת תנועה' : 'תנועה חדשה'}</h2><button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button></div>
        <div className="finv-seg">
          <button className={form.direction === 'expense' ? 'on' : ''} onClick={() => setDir('expense')}>הוצאה</button>
          <button className={form.direction === 'income' ? 'on' : ''} onClick={() => setDir('income')}>הכנסה</button>
        </div>
        <label className="finv-field"><span>סכום ₪</span><input type="number" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} autoFocus={drawerOpen} /></label>
        <label className="finv-field"><span>תאריך</span><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></label>
        <label className="finv-field"><span>קטגוריה</span><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="finv-field"><span>אמצעי תשלום</span><select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>{PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="finv-field"><span>תיאור</span><input type="text" placeholder="אופציונלי" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
        {formError && <div className="finv-form-err" role="alert">{formError}</div>}
        <button className="finv-save" disabled={saving} onClick={submitForm}>{saving ? 'שומר…' : 'שמירת תנועה'}</button>
      </aside>
    </div>
  )
}

// Inclusive list of {year, month} from one ISO date to another (capped).
function periodsBetween(fromISO: string, toISO: string): { year: number; month: number }[] {
  const res: { year: number; month: number }[] = []
  let y = Number(fromISO.slice(0, 4)), m = Number(fromISO.slice(5, 7))
  const ty = Number(toISO.slice(0, 4)), tm = Number(toISO.slice(5, 7))
  if (!y || !m || !ty || !tm || y > ty || (y === ty && m > tm)) return res
  let guard = 0
  while ((y < ty || (y === ty && m <= tm)) && guard++ < 600) {
    res.push({ year: y, month: m })
    m++; if (m > 12) { m = 1; y++ }
  }
  return res
}

function mapToBreakdown(map: Map<string, number>) {
  const arr = Array.from(map.entries()).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount)
  const max = arr[0]?.amount ?? 1
  return arr.map((a, i) => ({ ...a, pct: (a.amount / max) * 100, color: PALETTE[i % PALETTE.length] }))
}
