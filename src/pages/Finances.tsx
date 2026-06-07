import { useState } from 'react'
import {
  useTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../hooks/useTransactions'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../lib/constants'
import type { Transaction } from '../types'

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
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('he-IL')
}

export default function Finances() {
  const [year, setYear] = useState<number | undefined>(CURRENT_YEAR)
  const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1)
  const { transactions, loading, error, refetch } = useTransactions({ year, month })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const totalIncome = transactions
    .filter(t => t.direction === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpense = transactions
    .filter(t => t.direction === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  function openNew() {
    setForm(emptyForm)
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
    })
    setEditingId(t.id)
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
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

    const payload = {
      direction: form.direction,
      amount: Number(form.amount),
      date: form.date,
      category: form.category,
      description: form.description || null,
      contract_id: null,
      recurring_item_id: null,
      document_id: null,
    }

    const { error } = editingId
      ? await updateTransaction(editingId, payload)
      : await createTransaction(payload)

    if (error) {
      setFormError(error.message)
    } else {
      closeForm()
      refetch()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק תנועה זו?')) return
    await deleteTransaction(id)
    refetch()
  }

  const categories = form.direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className="page">
      <div className="page-header">
        <h1>כספים</h1>
        <button className="btn-primary" onClick={openNew}>+ תנועה חדשה</button>
      </div>

      {/* Filters */}
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

      {/* Summary */}
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

      {/* Form modal */}
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
                  <button
                    type="button"
                    className={`toggle-btn ${form.direction === 'income' ? 'active' : ''}`}
                    onClick={() => handleDirectionChange('income')}
                  >הכנסה</button>
                  <button
                    type="button"
                    className={`toggle-btn ${form.direction === 'expense' ? 'active' : ''}`}
                    onClick={() => handleDirectionChange('expense')}
                  >הוצאה</button>
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="amount">סכום (₪)</label>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="form-row">
                <label htmlFor="date">תאריך</label>
                <input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>

              <div className="form-row">
                <label htmlFor="category">קטגוריה</label>
                <select
                  id="category"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="description">תיאור</label>
                <input
                  id="description"
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="אופציונלי"
                />
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

      {/* Transaction list */}
      {loading && <div className="empty-state">טוען...</div>}
      {error && <div className="form-error">{error}</div>}
      {!loading && !error && transactions.length === 0 && (
        <div className="empty-state">אין תנועות בתקופה זו</div>
      )}
      {!loading && transactions.length > 0 && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>קטגוריה</th>
                <th>תיאור</th>
                <th>סכום</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td>{t.category}</td>
                  <td className="text-muted">{t.description ?? '—'}</td>
                  <td className={`amount ${t.direction}`}>
                    {t.direction === 'income' ? '+' : '-'}{formatAmount(Number(t.amount))}
                  </td>
                  <td className="row-actions">
                    <button className="btn-icon" onClick={() => openEdit(t)}>✏️</button>
                    <button className="btn-icon danger" onClick={() => handleDelete(t.id)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
