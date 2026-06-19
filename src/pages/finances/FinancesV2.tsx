import { useState, useEffect, useMemo } from 'react'
import {
  Sparkle, Plus, X, CaretDown, CaretLeft, CaretRight, ArrowUp, ArrowDown,
  ArrowDownLeft, ArrowUpRight, PencilSimple, Trash, Receipt, ChartPie,
} from '@phosphor-icons/react'
import { useTransactions, createTransaction, updateTransaction, deleteTransaction } from '../../hooks/useTransactions'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS, RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../../lib/constants'
import { monthlyVirtualEntries } from '../../lib/projections'
import type { VirtualEntry } from '../../lib/projections'
import { supabase } from '../../lib/supabase'
import { getReceiptSignedUrl } from '../../lib/storage'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency, formatDate } from '../../lib/format'
import type { Transaction, Contract, MortgageTrack } from '../../types'
import { SkeletonList } from '../../components/ui/Skeleton'
import { PageError } from '../../components/ui/EmptyState'
import './finances-v2.css'

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const PALETTE = ['var(--accent)', 'var(--accent-coral)', 'var(--accent-teal)', 'var(--accent-2)', 'var(--warning)', 'var(--success)', 'var(--danger)']
const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.filter(p => p.value).map(p => [p.value, p.label]))
const fmt = (v: number) => formatCurrency(v)

type Dir = 'income' | 'expense'

function parseNL(text: string): { amount: number | null; dir: Dir; cat: string; desc: string } {
  const amountMatch = text.match(/[\d,]+(\.\d+)?/)
  const amount = amountMatch ? Number(amountMatch[0].replace(/,/g, '')) : null
  const income = /(קיבלתי|נכנס|הכנסה|שכ"ד|שכ״ד|שכירות|שכר)/.test(text)
  const dir: Dir = income ? 'income' : 'expense'
  let cat = 'אחר'
  if (/תיקון|נזק|אינסטל|חשמלאי|צביע|שיפוץ/.test(text)) cat = 'תיקונים'
  else if (/ריבית/.test(text)) cat = 'ריבית'
  else if (income && /שכר|שכירות|שכ"ד|שכ״ד/.test(text)) cat = 'שכר דירה'
  // keep only valid one-time categories
  const valid = (dir === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES) as readonly string[]
  if (!valid.includes(cat)) cat = 'אחר'
  const m = text.match(/(?:על|עבור)\s+(.+)/)
  const desc = m ? m[1].trim() : ''
  return { amount, dir, cat, desc }
}

const emptyForm = { direction: 'expense' as Dir, amount: '', date: new Date().toISOString().slice(0, 10), category: EXPENSE_CATEGORIES[0] as string, description: '', payment_method: '' }

export default function FinancesV2() {
  const { user } = useAuth()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const { transactions, loading, error, refetch } = useTransactions({ year, month })

  const [contracts, setContracts] = useState<Contract[]>([])
  const [mortgageTracks, setMortgageTracks] = useState<MortgageTrack[]>([])
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('contracts').select('*').eq('owner_id', user.id),
      supabase.from('mortgage_tracks').select('*').eq('owner_id', user.id),
    ]).then(([c, t]) => { setContracts((c.data ?? []) as Contract[]); setMortgageTracks((t.data ?? []) as MortgageTrack[]) })
  }, [user?.id])

  const virtualEntries = useMemo<VirtualEntry[]>(() => monthlyVirtualEntries(contracts, mortgageTracks, year, month), [year, month, contracts, mortgageTracks])

  const [capture, setCapture] = useState('')
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const realRentExists = transactions.some(t => t.direction === 'income' && (RENT_CATEGORIES as readonly string[]).includes(t.category))
  const realMortgageExists = transactions.some(t => t.direction === 'expense' && (MORTGAGE_CATEGORIES as readonly string[]).includes(t.category))
  const shownVirtual = virtualEntries.filter(e => {
    if (e.direction === 'income' && (RENT_CATEGORIES as readonly string[]).includes(e.category) && realRentExists) return false
    if (e.direction === 'expense' && (MORTGAGE_CATEGORIES as readonly string[]).includes(e.category) && realMortgageExists) return false
    return true
  })

  const income = transactions.filter(t => t.direction === 'income').reduce((s, t) => s + Number(t.amount), 0) + shownVirtual.filter(e => e.direction === 'income').reduce((s, e) => s + e.amount, 0)
  const expense = transactions.filter(t => t.direction === 'expense').reduce((s, t) => s + Number(t.amount), 0) + shownVirtual.filter(e => e.direction === 'expense').reduce((s, e) => s + e.amount, 0)
  const net = income - expense
  const inPct = income + expense > 0 ? (income / (income + expense)) * 100 : 50

  const breakdown = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter(t => t.direction === 'expense').forEach(t => map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount)))
    shownVirtual.filter(e => e.direction === 'expense').forEach(e => map.set(e.category, (map.get(e.category) ?? 0) + e.amount))
    const arr = Array.from(map.entries()).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount)
    const max = arr[0]?.amount ?? 1
    return arr.map((a, i) => ({ ...a, pct: (a.amount / max) * 100, color: PALETTE[i % PALETTE.length] }))
  }, [transactions, shownVirtual])

  const parsed = parseNL(capture)
  const showChips = parsed.amount != null

  async function addFromCapture() {
    if (parsed.amount == null || !user) return
    const payload: Partial<Transaction> = {
      direction: parsed.dir, amount: parsed.amount, date: new Date().toISOString().slice(0, 10),
      category: parsed.cat, description: parsed.desc || null, payment_method: null, contract_id: null, recurring_item_id: null,
    }
    await createTransaction(payload as Omit<Transaction, 'id' | 'owner_id' | 'created_at'>)
    setCapture('')
    setYear(today.getFullYear()); setMonth(today.getMonth() + 1)
    refetch()
  }

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

  async function handleDelete(id: string) { await deleteTransaction(id); setConfirmDeleteId(null); refetch() }
  async function openReceipt(t: Transaction) {
    if (!t.document_id) return
    const { data } = await supabase.from('documents').select('storage_path').eq('id', t.document_id).single()
    if (!data) return
    window.open(await getReceiptSignedUrl(data.storage_path), '_blank')
  }

  function shiftMonth(delta: number) {
    let m = month + delta, y = year
    if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  const categories = form.direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const colorFor = (cat: string) => { const b = breakdown.find(x => x.cat === cat); return b ? b.color : 'var(--text-muted)' }

  if (error) return <PageError message={error} onRetry={refetch} />

  return (
    <div className="finv">
      <div className="finv-monthnav">
        <button className="finv-monthnav-btn" onClick={() => shiftMonth(-1)} aria-label="חודש קודם"><CaretRight size={18} weight="bold" /></button>
        <span className="finv-monthnav-label">{MONTH_NAMES[month - 1]} {year}</span>
        <button className="finv-monthnav-btn" onClick={() => shiftMonth(1)} aria-label="חודש הבא"><CaretLeft size={18} weight="bold" /></button>
      </div>

      <div className="finv-summary">
        <div className="finv-summary-label">מאזן החודש</div>
        <div className={`finv-summary-net ${net >= 0 ? 'pos' : 'neg'}`}>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}</div>
        <div className="finv-summary-bar"><div className="in" style={{ width: `${inPct}%` }} /><div className="out" style={{ width: `${100 - inPct}%` }} /></div>
        <div className="finv-summary-tiles">
          <div className="finv-summary-tile in"><span className="finv-summary-tile-label"><ArrowDown size={13} weight="bold" /> הכנסות</span><span className="finv-summary-tile-value">{fmt(income)}</span></div>
          <div className="finv-summary-tile out"><span className="finv-summary-tile-label"><ArrowUp size={13} weight="bold" /> הוצאות</span><span className="finv-summary-tile-value">{fmt(expense)}</span></div>
        </div>
      </div>

      <div className="finv-capture">
        <div className="finv-capture-row">
          <Sparkle className="finv-capture-icon" size={20} weight="fill" />
          <input className="finv-capture-input" placeholder="הזנה מהירה — לדוגמה: שילמתי 1,240 על תיקון דוד שמש" value={capture}
            onChange={e => setCapture(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addFromCapture() }} />
          <button className="finv-capture-send" disabled={!showChips} onClick={addFromCapture} aria-label="הוסף תנועה"><Plus size={18} weight="bold" /></button>
        </div>
        {showChips ? (
          <div className="finv-chips">
            <span className="finv-chip amount">{fmt(parsed.amount!)}</span>
            <span className={`finv-chip dir-${parsed.dir}`}>{parsed.dir === 'income' ? 'הכנסה' : 'הוצאה'}</span>
            <span className="finv-chip">{parsed.cat}</span>
            <span className="finv-chip">היום</span>
            {parsed.desc && <span className="finv-chip">{parsed.desc}</span>}
          </div>
        ) : (
          <div className="finv-capture-hint">כתוב במילים שלך, או <button className="finv-capture-structured" onClick={openNew}>פתח טופס מלא</button></div>
        )}
      </div>

      {expense > 0 && breakdown.length > 0 && (
        <div className={`finv-breakdown ${breakdownOpen ? 'open' : ''}`}>
          <button className="finv-breakdown-head" onClick={() => setBreakdownOpen(o => !o)}>
            <h3><ChartPie size={17} weight="duotone" /> פילוח הוצאות לפי קטגוריה</h3>
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
            return (
              <div key={t.id} className="finv-tx">
                <span className="finv-cat-icon" style={{ background: colorFor(t.category) || 'var(--text-muted)' }}>{t.direction === 'income' ? <ArrowDownLeft size={20} weight="bold" /> : <ArrowUpRight size={20} weight="bold" />}</span>
                <div className="finv-tx-body"><div className="finv-tx-top"><span className="finv-tx-cat">{t.category}</span></div><span className="finv-tx-meta">{formatDate(t.date)}{meta ? ` · ${meta}` : ''}</span></div>
                <div className="finv-tx-side">
                  <span className={`finv-tx-amount ${t.direction}`}>{t.direction === 'income' ? '+' : '−'}{fmt(Number(t.amount))}</span>
                  <div className="finv-tx-actions">
                    {t.document_id && <button className="finv-icon-btn" aria-label="קבלה" onClick={() => openReceipt(t)}><Receipt size={15} /></button>}
                    <button className="finv-icon-btn" aria-label="עריכה" onClick={() => openEdit(t)}><PencilSimple size={15} /></button>
                    {confirmDeleteId === t.id ? (
                      <>
                        <button className="finv-icon-btn danger" aria-label="אישור מחיקה" onClick={() => handleDelete(t.id)}><Trash size={15} weight="fill" /></button>
                        <button className="finv-icon-btn" aria-label="ביטול" onClick={() => setConfirmDeleteId(null)}><X size={15} /></button>
                      </>
                    ) : (
                      <button className="finv-icon-btn danger" aria-label="מחיקה" onClick={() => setConfirmDeleteId(t.id)}><Trash size={15} /></button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
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
