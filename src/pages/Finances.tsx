import { PencilSimple, Trash, X, Receipt } from '@phosphor-icons/react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  useTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../hooks/useTransactions'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS, RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../lib/constants'
import { monthlyVirtualEntries } from '../lib/projections'
import type { VirtualEntry } from '../lib/projections'
import { uploadReceipt, getReceiptSignedUrl } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '../lib/format'
import type { Transaction, Contract, MortgageTrack } from '../types'
import { SkeletonList } from '../components/ui/Skeleton'
import { PageError } from '../components/ui/EmptyState'
import { BarChart } from '../components/ui/BarChart'
import { DonutChart } from '../components/ui/DonutChart'
import { ClayIllustration } from '../components/ui/ClayIllustration'

interface RepairPrefill {
  direction: 'expense'
  category: string
  description: string
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = [
  { value: 1, label: 'ינואר' },
  { value: 2, label: 'פברואר' },
  { value: 3, label: 'מרץ' },
  { value: 4, label: 'אפריל' },
  { value: 5, label: 'מאי' },
  { value: 6, label: 'יוני' },
  { value: 7, label: 'יולי' },
  { value: 8, label: 'אוגוסט' },
  { value: 9, label: 'ספטמבר' },
  { value: 10, label: 'אוקטובר' },
  { value: 11, label: 'נובמבר' },
  { value: 12, label: 'דצמבר' },
]

const emptyForm = {
  direction: 'income' as 'income' | 'expense',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  category: INCOME_CATEGORIES[0] as string,
  description: '',
  payment_method: '',
}

function formatAmount(amount: number) {
  return formatCurrency(amount)
}

const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.filter(p => p.value).map(p => [p.value, p.label])
)

const DONUT_PALETTE = [
  'var(--accent)',
  'var(--accent-coral)',
  'var(--accent-teal)',
  'var(--danger)',
  'var(--brand-navy)',
  'var(--success)',
]

export default function Finances() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [year, setYear] = useState<number | undefined>(CURRENT_YEAR)
  const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1)
  const { transactions, loading, error, refetch } = useTransactions({ year, month })

  const [contracts, setContracts] = useState<Contract[]>([])
  const [mortgageTracks, setMortgageTracks] = useState<MortgageTrack[]>([])
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('contracts').select('*').eq('owner_id', user.id),
      supabase.from('mortgage_tracks').select('*').eq('owner_id', user.id),
    ]).then(([cRes, tRes]) => {
      setContracts((cRes.data ?? []) as Contract[])
      setMortgageTracks((tRes.data ?? []) as MortgageTrack[])
    })
  }, [user?.id])

  const virtualEntries = useMemo<VirtualEntry[]>(
    () => year ? monthlyVirtualEntries(contracts, mortgageTracks, year, month) : [],
    [year, month, contracts, mortgageTracks]
  )

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Open pre-filled form when navigated here from a repair task, or blank form via openForm flag
  useEffect(() => {
    const state = location.state as { prefill?: RepairPrefill; openForm?: boolean } | null
    if (state?.prefill) {
      const prefill = state.prefill
      setForm({
        direction: prefill.direction,
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        category: prefill.category,
        description: prefill.description,
        payment_method: '',
      })
      setEditingId(null)
      setReceiptFile(null)
      setFormError(null)
      setShowForm(true)
      navigate(location.pathname, { replace: true, state: {} })
    } else if (state?.openForm) {
      setForm(emptyForm)
      setEditingId(null)
      setReceiptFile(null)
      setFormError(null)
      setShowForm(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Actual overrides projected": hide the virtual row when a real transaction
  // of the same type exists for the selected period.
  const realRentExists = transactions.some(t => t.direction === 'income' && (RENT_CATEGORIES as readonly string[]).includes(t.category))
  const realMortgageExists = transactions.some(t => t.direction === 'expense' && (MORTGAGE_CATEGORIES as readonly string[]).includes(t.category))

  const shownVirtual = virtualEntries.filter(e => {
    if (e.direction === 'income' && (RENT_CATEGORIES as readonly string[]).includes(e.category) && realRentExists) return false
    if (e.direction === 'expense' && (MORTGAGE_CATEGORIES as readonly string[]).includes(e.category) && realMortgageExists) return false
    return true
  })

  const totalIncome = transactions.filter(t => t.direction === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
    + shownVirtual.filter(e => e.direction === 'income').reduce((sum, e) => sum + e.amount, 0)

  const totalExpense = transactions.filter(t => t.direction === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)
    + shownVirtual.filter(e => e.direction === 'expense').reduce((sum, e) => sum + e.amount, 0)

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter(t => t.direction === 'expense').forEach(t => {
      map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount))
    })
    shownVirtual.filter(e => e.direction === 'expense').forEach(e => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    })
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .map((d, i) => ({ ...d, color: DONUT_PALETTE[i % DONUT_PALETTE.length] }))
  }, [transactions, shownVirtual])

  function openNew() {
    setForm(emptyForm)
    setReceiptFile(null)
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(t: Transaction) {
    setForm({
      direction: t.direction,
      amount: String(t.amount),
      date: t.date,
      category: t.category,
      description: t.description ?? '',
      payment_method: t.payment_method ?? '',
    })
    setReceiptFile(null)
    setEditingId(t.id)
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setReceiptFile(null)
  }

  function handleDirectionChange(dir: 'income' | 'expense') {
    setForm(f => ({
      ...f,
      direction: dir,
      category: dir === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError('יש להזין סכום תקין')
      return
    }
    setSaving(true)
    setFormError(null)

    try {
      const payload: Partial<Transaction> = {
        direction: form.direction,
        amount: Number(form.amount),
        date: form.date,
        category: form.category,
        description: form.description || null,
        payment_method: form.payment_method || null,
        contract_id: null,
        recurring_item_id: null,
      }

      let txId = editingId

      if (editingId) {
        const { error } = await updateTransaction(editingId, payload)
        if (error) throw new Error(error.message)
      } else {
        const { data, error } = await createTransaction(payload as Omit<Transaction, 'id' | 'owner_id' | 'created_at'>)
        if (error) throw new Error(error.message)
        txId = (data as Transaction)?.id ?? null
      }

      // Upload receipt if provided
      if (receiptFile && txId) {
        const storagePath = await uploadReceipt(receiptFile, txId)
        // Save document record and link to transaction
        const { data: docData } = await supabase
          .from('documents')
          .insert({
            owner_id: user!.id,
            transaction_id: txId,
            type: 'receipt',
            name: receiptFile.name,
            storage_path: storagePath,
            date: form.date,
          })
          .select('id')
          .single()

        if (docData?.id) {
          await updateTransaction(txId, { document_id: docData.id })
        }
      }

      closeForm()
      refetch()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'שגיאה בשמירה')
    }
    setSaving(false)
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    await deleteTransaction(id)
    setConfirmDeleteId(null)
    refetch()
  }

  async function openReceipt(t: Transaction) {
    if (!t.document_id) return
    const { data } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', t.document_id)
      .single()
    if (!data) return
    const url = await getReceiptSignedUrl(data.storage_path)
    window.open(url, '_blank')
  }

  const categories = form.direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  if (loading) return <SkeletonList rows={6} />
  if (error) return <PageError message={error} onRetry={refetch} />

  return (
    <>
      <div className="sub-page-actions">
        <button className="btn-primary" onClick={openNew}>+ תנועה חדשה</button>
      </div>

      <div className="filters">
        <select value={year ?? ''} onChange={e => setYear(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">כל השנים</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month ?? ''} onChange={e => setMonth(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">כל החודשים</option>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="summary-cards">
        <div className="summary-card income">
          <div className="summary-label">הכנסות</div>
          <div className="summary-amount">{formatAmount(totalIncome)}</div>
        </div>
        <div className="summary-card expense">
          <div className="summary-label">הוצאות</div>
          <div className="summary-amount">{formatAmount(totalExpense)}</div>
        </div>
        <div className="summary-card balance">
          <div className="summary-label">מאזן</div>
          <div className={`summary-amount ${totalIncome - totalExpense >= 0 ? 'positive' : 'negative'}`}>
            {formatAmount(totalIncome - totalExpense)}
          </div>
        </div>
      </div>

      {(totalIncome > 0 || totalExpense > 0) && (
        <div className="chart-card">
          <div className="chart-card-title">הכנסות מול הוצאות — התקופה הנבחרת</div>
          <BarChart
            data={[
              { label: 'הכנסות', value: totalIncome, color: 'var(--success)' },
              { label: 'הוצאות', value: totalExpense, color: 'var(--danger)' },
            ]}
            height={120}
            formatValue={formatCurrency}
          />
        </div>
      )}

      {totalExpense > 0 && (
        <div className="chart-card">
          <div className="chart-card-title">פילוח הוצאות לפי קטגוריה</div>
          <DonutChart
            data={expenseByCategory}
            centerLabel="הוצאות"
            formatValue={formatCurrency}
          />
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'עריכת תנועה' : 'תנועה חדשה'}</h2>
              <button className="btn-icon" onClick={closeForm} aria-label="סגור" title="סגור"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="form-row">
                <label>סוג</label>
                <div className="toggle-group">
                  <button type="button"
                    className={`toggle-btn ${form.direction === 'income' ? 'active' : ''}`}
                    onClick={() => handleDirectionChange('income')}>הכנסה</button>
                  <button type="button"
                    className={`toggle-btn ${form.direction === 'expense' ? 'active' : ''}`}
                    onClick={() => handleDirectionChange('expense')}>הוצאה</button>
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="amount">סכום (₪)</label>
                <input id="amount" type="text" inputMode="numeric"
                  value={form.amount ? Number(form.amount.replace(/,/g, '')).toLocaleString('he-IL') : ''}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') }))} required />
              </div>

              <div className="form-row">
                <label htmlFor="date">תאריך</label>
                <input id="date" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>

              <div className="form-row">
                <label htmlFor="category">קטגוריה</label>
                <select id="category" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="payment_method">אמצעי תשלום</label>
                <select id="payment_method" value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="description">תיאור</label>
                <input id="description" type="text" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="אופציונלי" />
              </div>

              <div className="form-row">
                <label>קבלה</label>
                <div className="file-upload">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                  <button type="button" className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}>
                    {receiptFile ? receiptFile.name : 'בחר קובץ'}
                  </button>
                  {receiptFile && (
                    <button type="button" className="btn-icon" aria-label="הסר קובץ" title="הסר קובץ"
                      onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeForm}>ביטול</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transactions.length === 0 && shownVirtual.length === 0 && (
        <div className="empty-state-cta">
          <div className="empty-state-cta-icon"><ClayIllustration variant="receipt" /></div>
          <p>אין תנועות בתקופה זו</p>
          <button className="btn-primary" onClick={openNew}>+ תנועה חדשה</button>
        </div>
      )}
      {(transactions.length > 0 || shownVirtual.length > 0) && (
        <div className="fin-list">
          {shownVirtual.length > 0 && (
            <p className="text-muted virtual-legend">
              השורות המקווקוות הן תחזית מהחוזה/המשכנתא — יוחלפו בתנועה אמיתית כשתירשם.
            </p>
          )}
          <ul className="fin-list-items">
            {shownVirtual.map(e => (
              <li key={e.id} className="fin-item virtual">
                <div className="fin-item-main">
                  <div className="fin-item-top">
                    <span className="fin-item-cat">{e.category}</span>
                    <span className="fin-item-date">{formatDate(e.date)}</span>
                  </div>
                  {e.description && <div className="fin-item-meta">{e.description}</div>}
                </div>
                <div className="fin-item-side">
                  <span className={`fin-item-amount ${e.direction}`}>
                    {e.direction === 'income' ? '+' : '−'}{formatAmount(e.amount)}
                  </span>
                </div>
              </li>
            ))}
            {transactions.map(t => {
              const meta = [
                t.description,
                t.payment_method ? PAYMENT_LABEL[t.payment_method] : null,
              ].filter(Boolean).join(' · ')
              return (
                <li key={t.id} className="fin-item">
                  <div className="fin-item-main">
                    <div className="fin-item-top">
                      <span className="fin-item-cat">{t.category}</span>
                      <span className="fin-item-date">{formatDate(t.date)}</span>
                    </div>
                    {meta && <div className="fin-item-meta">{meta}</div>}
                  </div>
                  <div className="fin-item-side">
                    <span className={`fin-item-amount ${t.direction}`}>
                      {t.direction === 'income' ? '+' : '−'}{formatAmount(Number(t.amount))}
                    </span>
                    <div className="fin-item-actions">
                      {t.document_id && (
                        <button className="btn-icon receipt-btn" aria-label="פתח קבלה" title="פתח קבלה" onClick={() => openReceipt(t)}>
                          <Receipt size={16} />
                        </button>
                      )}
                      <button className="btn-icon" onClick={() => openEdit(t)} aria-label="עריכה" title="עריכה"><PencilSimple size={16} /></button>
                      {confirmDeleteId === t.id ? (
                        <span className="mortgage-delete-confirm">
                          <span className="mortgage-delete-confirm-label">למחוק?</span>
                          <button className="btn-xs btn-danger-solid" onClick={() => handleDelete(t.id)}>מחק</button>
                          <button className="btn-xs btn-secondary" onClick={() => setConfirmDeleteId(null)}>ביטול</button>
                        </span>
                      ) : (
                        <button className="btn-icon danger" onClick={() => setConfirmDeleteId(t.id)} aria-label="מחיקה" title="מחיקה"><Trash size={16} /></button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
