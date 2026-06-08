import { useState } from 'react'
import { useTasks, createTask, updateTask, deleteTask } from '../hooks/useTasks'
import { TASK_CATEGORIES } from '../lib/constants'
import type { Task } from '../types'

const emptyForm = {
  title: '',
  category: TASK_CATEGORIES[0],
  due_date: '',
  status: 'open' as Task['status'],
}

function formatDate(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('he-IL')
}

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false
  return new Date(task.due_date) < new Date(new Date().toISOString().slice(0, 10))
}

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState<'open' | 'done' | 'all'>('open')
  const { tasks, loading, error, refetch } = useTasks({ status: statusFilter })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openNew() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(task: Task) {
    setForm({
      title: task.title,
      category: task.category,
      due_date: task.due_date ?? '',
      status: task.status,
    })
    setEditingId(task.id)
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setFormError('יש להזין כותרת')
      return
    }
    setSaving(true)
    setFormError(null)

    const payload = {
      title: form.title.trim(),
      category: form.category,
      due_date: form.due_date || null,
      status: form.status,
      source: 'manual' as Task['source'],
      is_recurring: false,
      recurrence_days: null,
      property_id: null,
      recurring_item_id: null,
      transaction_id: null,
    }

    try {
      const { error } = editingId
        ? await updateTask(editingId, payload)
        : await createTask(payload)
      if (error) throw new Error(error.message)
      closeForm()
      refetch()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'שגיאה בשמירה')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק משימה זו?')) return
    await deleteTask(id)
    refetch()
  }

  async function toggleDone(task: Task) {
    const newStatus = task.status === 'done' ? 'open' : 'done'
    await updateTask(task.id, { status: newStatus })
    refetch()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>משימות</h1>
        <button className="btn-primary" onClick={openNew}>+ משימה חדשה</button>
      </div>

      <div className="filters">
        <div className="toggle-group">
          <button type="button"
            className={`toggle-btn ${statusFilter === 'open' ? 'active' : ''}`}
            onClick={() => setStatusFilter('open')}>פתוחות</button>
          <button type="button"
            className={`toggle-btn ${statusFilter === 'done' ? 'active' : ''}`}
            onClick={() => setStatusFilter('done')}>הושלמו</button>
          <button type="button"
            className={`toggle-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}>הכל</button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'עריכת משימה' : 'משימה חדשה'}</h2>
              <button className="btn-icon" onClick={closeForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="form-row">
                <label htmlFor="task-title">כותרת</label>
                <input id="task-title" type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="תיאור המשימה" autoFocus required />
              </div>

              <div className="form-row">
                <label htmlFor="task-category">קטגוריה</label>
                <select id="task-category" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="task-due">תאריך יעד</label>
                <input id="task-due" type="date" value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>

              {editingId && (
                <div className="form-row">
                  <label>סטטוס</label>
                  <div className="toggle-group">
                    <button type="button"
                      className={`toggle-btn ${form.status === 'open' ? 'active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, status: 'open' }))}>פתוחה</button>
                    <button type="button"
                      className={`toggle-btn ${form.status === 'done' ? 'active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, status: 'done' }))}>הושלמה</button>
                  </div>
                </div>
              )}

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
      {!loading && !error && tasks.length === 0 && (
        <div className="empty-state">אין משימות</div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>כותרת</th>
                <th>קטגוריה</th>
                <th>תאריך יעד</th>
                <th>מקור</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id} className={task.status === 'done' ? 'task-done' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={task.status === 'done'}
                      onChange={() => toggleDone(task)}
                      className="task-checkbox"
                    />
                  </td>
                  <td className={isOverdue(task) ? 'task-overdue' : ''}>
                    {task.title}
                  </td>
                  <td className="text-muted">{task.category}</td>
                  <td className={isOverdue(task) ? 'task-overdue' : 'text-muted'}>
                    {formatDate(task.due_date)}
                  </td>
                  <td>
                    {task.source !== 'manual' && (
                      <span className={`badge ${task.source}`}>
                        {task.source === 'recurring_item' ? 'קבוע' : 'חידוש'}
                      </span>
                    )}
                  </td>
                  <td className="row-actions">
                    <button className="btn-icon" onClick={() => openEdit(task)}>✏️</button>
                    <button className="btn-icon danger" onClick={() => handleDelete(task.id)}>🗑</button>
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
