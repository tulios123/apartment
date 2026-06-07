import { useState } from 'react'
import {
  useRecurringItems,
  createRecurringItem,
  updateRecurringItem,
  deleteRecurringItem,
} from '../hooks/useRecurringItems'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../lib/constants'
import type { RecurringItem } from '../types'

const emptyForm = {
  direction: 'expense' as 'income' | 'expense',
  amount: '',
  category: EXPENSE_CATEGORIES[0],
  day_of_month: '1',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  payee: '',
  execution_type: 'automatic' as 'automatic' | 'requires_approval',
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)
}

const EXECUTION_LABELS = { automatic: 'אוטומטי', requires_approval: 'דורש אישור' }
const DIRECTION_LABELS = { income: 'הכנסה', expense: 'הוצאה' }

export default function RecurringItems() {
  const { items, loading, error, refetch } = useRecurringItems()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const income = items.filter(i => i.direction === 'income')
  const expenses = items.filter(i => i.direction === 'expense')

  function openNew() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(item: RecurringItem) {
    setForm({
      direction: item.direction,
      amount: String(item.amount),
      category: item.category,
      day_of_month: String(item.day_of_month),
      start_date: item.start_date,
      end_date: item.end_date ?? '',
      payee: item.payee ?? '',
      execution_type: item.execution_type,
    })
    setEditingId(item.id)
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
      category: form.category,
      day_of_month: Number(form.day_of_month),
      start_date: form.start_date,
      end_date: form.end_date || null,
      payee: form.payee || null,
      execution_type: form.execution_type,
      contract_id: null,
      renewal_alert_days: [90, 30],
    }

    const { error } = editingId
      ? await updateRecurringItem(editingId, payload)
      : await createRecurringItem(payload)

    if (error) {
      setFormError(error.message)
    } else {
      closeForm()
      refetch()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק פריט חוזר זה?')) return
    await deleteRecurringItem(id)
    refetch()
  }

  const categories = form.direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className="page">
      <div className="page-header">
        <h1>פריטים קבועים</h1>
        <button className="btn-primary" onClick={openNew}>+ פריט חדש</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'עריכת פריט' : 'פריט חדש'}</h2>
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
                <label htmlFor="ri-category">קטגוריה</label>
                <select id="ri-category" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="ri-amount">סכום (₪)</label>
                <input id="ri-amount" type="number" min="0" step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>

              <div className="form-row">
                <label htmlFor="ri-payee">מקבל / משלם</label>
                <input id="ri-payee" type="text" value={form.payee}
                  onChange={e => setForm(f => ({ ...f, payee: e.target.value }))}
                  placeholder="אופציונלי" />
              </div>

              <div className="form-row">
                <label htmlFor="ri-day">יום בחודש</label>
                <input id="ri-day" type="number" min="1" max="28"
                  value={form.day_of_month}
                  onChange={e => setForm(f => ({ ...f, day_of_month: e.target.value }))} required />
              </div>

              <div className="form-row">
                <label htmlFor="ri-start">תאריך התחלה</label>
                <input id="ri-start" type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
              </div>

              <div className="form-row">
                <label htmlFor="ri-end">תאריך סיום</label>
                <input id="ri-end" type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>

              <div className="form-row">
                <label>ביצוע</label>
                <div className="toggle-group">
                  <button type="button"
                    className={`toggle-btn ${form.execution_type === 'automatic' ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, execution_type: 'automatic' }))}>אוטומטי</button>
                  <button type="button"
                    className={`toggle-btn ${form.execution_type === 'requires_approval' ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, execution_type: 'requires_approval' }))}>דורש אישור</button>
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

      {loading && <div className="empty-state">טוען...</div>}
      {error && <div className="form-error">{error}</div>}

      {!loading && (
        <>
          <RecurringSection
            title="הכנסות"
            items={income}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          <RecurringSection
            title="הוצאות"
            items={expenses}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
  )
}

function RecurringSection({
  title, items, onEdit, onDelete,
}: {
  title: string
  items: RecurringItem[]
  onEdit: (item: RecurringItem) => void
  onDelete: (id: string) => void
}) {
  if (items.length === 0) return (
    <div className="section">
      <h2 className="section-title">{title}</h2>
      <div className="empty-state small">אין פריטים</div>
    </div>
  )

  return (
    <div className="section">
      <h2 className="section-title">{title}</h2>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>קטגוריה</th>
              <th>מקבל / משלם</th>
              <th>סכום</th>
              <th>יום</th>
              <th>ביצוע</th>
              <th>תוקף</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.category}</td>
                <td className="text-muted">{item.payee ?? '—'}</td>
                <td className={`amount ${item.direction}`}>
                  {formatAmount(Number(item.amount))}
                </td>
                <td>{item.day_of_month}</td>
                <td>
                  <span className={`badge ${item.execution_type}`}>
                    {EXECUTION_LABELS[item.execution_type]}
                  </span>
                </td>
                <td className="text-muted">
                  {item.end_date
                    ? new Date(item.end_date).toLocaleDateString('he-IL')
                    : 'ללא הגבלה'}
                </td>
                <td className="row-actions">
                  <button className="btn-icon" onClick={() => onEdit(item)}>✏️</button>
                  <button className="btn-icon danger" onClick={() => onDelete(item.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
