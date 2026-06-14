import { ArrowsClockwise, PencilSimple, Trash, X } from '@phosphor-icons/react'
import { useState } from 'react'
import {
  useRecurringItems,
  createRecurringItem,
  updateRecurringItem,
  deleteRecurringItem,
} from '../hooks/useRecurringItems'
import { RECURRING_INCOME_CATEGORIES, RECURRING_EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../lib/constants'
import { formatCurrency, formatDate } from '../lib/format'
import type { RecurringItem } from '../types'
import { SkeletonList } from '../components/ui/Skeleton'

const emptyForm = {
  direction: 'expense' as 'income' | 'expense',
  amount: '',
  category: RECURRING_EXPENSE_CATEGORIES[0],
  day_of_month: '1',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  payee: '',
  execution_type: 'automatic' as 'automatic' | 'requires_approval',
  payment_method: '',
}

function formatAmount(n: number) {
  return formatCurrency(n)
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
      payment_method: item.payment_method ?? '',
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
      category: dir === 'income' ? RECURRING_INCOME_CATEGORIES[0] : RECURRING_EXPENSE_CATEGORIES[0],
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
      payment_method: form.payment_method || null,
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

  const categories = form.direction === 'income' ? RECURRING_INCOME_CATEGORIES : RECURRING_EXPENSE_CATEGORIES

  if (loading) return <SkeletonList rows={5} />
  if (error) return <div className="form-error" role="alert">{error}</div>

  return (
    <>
      <div className="sub-page-actions">
        <button className="btn-primary" onClick={openNew}>+ פריט חדש</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'עריכת פריט' : 'פריט חדש'}</h2>
              <button className="btn-icon" onClick={closeForm} aria-label="סגור" title="סגור"><X size={16} /></button>
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
                <input id="ri-amount" type="text" inputMode="numeric"
                  value={form.amount ? Number(form.amount.replace(/,/g, '')).toLocaleString('en-US') : ''}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') }))} required />
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

              <div className="form-row">
                <label htmlFor="ri-payment">אמצעי תשלום</label>
                <select id="ri-payment" value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
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

      {items.length === 0 ? (
        <div className="empty-state-cta">
          <div className="empty-state-cta-icon"><ArrowsClockwise size={40} /></div>
          <p>עדיין לא הוספת פריטים חוזרים</p>
          <button className="btn-primary" onClick={openNew}>+ פריט חדש</button>
        </div>
      ) : (
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
    </>
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
      <div className="fin-list">
        <ul className="fin-list-items">
          {items.map(item => {
            const paymentLabel = item.payment_method
              ? PAYMENT_METHODS.find(p => p.value === item.payment_method)?.label
              : null
            const meta = [
              `יום ${item.day_of_month} בחודש`,
              paymentLabel,
              item.end_date ? `עד ${formatDate(item.end_date)}` : null,
            ].filter(Boolean).join(' · ')
            return (
              <li key={item.id} className="fin-item">
                <div className="fin-item-main">
                  <div className="fin-item-top">
                    <span className="fin-item-cat">{item.category}</span>
                    {item.payee && <span className="fin-item-date">{item.payee}</span>}
                  </div>
                  <div className="fin-item-meta">
                    {meta}
                    <span className={`badge ${item.execution_type}`}>
                      {EXECUTION_LABELS[item.execution_type]}
                    </span>
                  </div>
                </div>
                <div className="fin-item-side">
                  <span className={`fin-item-amount ${item.direction}`}>
                    {formatAmount(Number(item.amount))}
                  </span>
                  <div className="fin-item-actions">
                    <button className="btn-icon" onClick={() => onEdit(item)} aria-label="עריכה" title="עריכה"><PencilSimple size={16} /></button>
                    <button className="btn-icon danger" onClick={() => onDelete(item.id)} aria-label="מחיקה" title="מחיקה"><Trash size={16} /></button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
