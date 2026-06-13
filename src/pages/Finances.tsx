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
import { BarChart } from '../components/ui/BarChart'

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
  category: INCOME_CATEGORIES[0],
  description: '',
  payment_method: '',
}

function formatAmount(amount: number) {
  return formatCurrency(amount)
}

const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.filter(p => p.value).map(p => [p.value, p.label])
)

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

  // Open pre-filled form when navigated here from a repair task
  useEffect(() => {
    const prefill = (location.state as { prefill?: RepairPrefill } | null)?.prefill
    if (prefill) {
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
      // Clear the state so re-visiting the page doesn't re-open the form
      navigate(location.pathname, { replace: true, state: {} })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rentCatSet = new Set(RENT_CATEGORIES as readonly string[])
  const mortCatSet = new Set(MORTGAGE_CATEGORIES as readonly string[])

  const totalIncome = transactions.filter(t => t.direction === 'income' && !rentCatSet.has(t.category)).reduce((sum, t) => sum + Number(t.amount), 0)
    + virtualEntries.filter(e => e.direction === 'income').reduce((sum, e) => sum + e.amount, 0)

  const totalExpense = transactions.filter(t => t.direction === 'expense' && !mortCatSet.has(t.category)).reduce((sum, t) => sum + Number(t.amount), 0)
    + virtualEntries.filter(e => e.direction === 'expense').reduce((sum, e) => sum + e.amount, 0)

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

  async function handleDelete(id: string) {
    if (!confirm('למחוק תנועה זו?')) return
    await deleteTransaction(id)
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
  if (error) return <div className="form-error">{error}</div>

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

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'עריכת תנועה' : 'תנועה חדשה'}</h2>
              <button className="btn-icon" onClick={closeForm}>✕</button>
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
                  value={form.amount ? Number(form.amount.replace(/,/g, '')).toLocaleString('en-US') : ''}
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
                    <button type="button" className="btn-icon"
                      onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {formError && <div className="form-error">{formError}</div>}
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

      {transactions.length === 0 && virtualEntries.length === 0 && (
        <div className="empty-state-cta">
          <div className="empty-state-cta-icon">💸</div>
          <p>אין תנועות בתקופה זו</p>
          <button className="btn-primary" onClick={openNew}>+ תנועה חדשה</button>
        </div>
      )}
      {(transactions.length > 0 || virtualEntries.length > 0) && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>קטגוריה</th>
                <th>תיאור</th>
                <th>אמצעי תשלום</th>
                <th>סכום</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {virtualEntries.map(e => (
                <tr key={e.id} className="virtual-tx-row">
                  <td>{formatDate(e.date)}</td>
                  <td>{e.category} <span className="virtual-badge">מחושב</span></td>
                  <td className="text-muted">{e.description}</td>
                  <td className="text-muted">—</td>
                  <td className={`amount ${e.direction}`}>
                    {e.direction === 'income' ? '+' : '-'}{formatAmount(e.amount)}
                  </td>
                  <td></td>
                </tr>
              ))}
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td>{t.category}</td>
                  <td className="text-muted">{t.description ?? '—'}</td>
                  <td className="text-muted">{t.payment_method ? PAYMENT_LABEL[t.payment_method] : '—'}</td>
                  <td className={`amount ${t.direction}`}>
                    {t.direction === 'income' ? '+' : '-'}{formatAmount(Number(t.amount))}
                  </td>
                  <td className="row-actions">
                    {t.document_id && (
                      <button className="btn-icon receipt-btn" title="פתח קבלה" onClick={() => openReceipt(t)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                      </button>
                    )}
                    <button className="btn-icon" onClick={() => openEdit(t)}>✏️</button>
                    <button className="btn-icon danger" onClick={() => handleDelete(t.id)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
