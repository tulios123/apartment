import { useState, useRef, useEffect } from 'react'
import { useTasks, createTask, updateTask, deleteTask } from '../hooks/useTasks'
import { TASK_CATEGORIES } from '../lib/constants'
import { formatDate } from '../lib/format'
import type { Task } from '../types'

const emptyForm = {
  title: '',
  category: TASK_CATEGORIES[0],
  due_date: '',
  status: 'open' as Task['status'],
}

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false
  return new Date(task.due_date) < new Date(new Date().toISOString().slice(0, 10))
}

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState<'open' | 'done' | 'all'>('open')
  const { tasks, loading, error, refetch } = useTasks({ status: statusFilter })

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState(emptyForm)

  const [addingTitle, setAddingTitle] = useState('')
  const [addingDue, setAddingDue] = useState('')
  const [showAddDetails, setShowAddDetails] = useState(false)
  const [addingCategory, setAddingCategory] = useState(TASK_CATEGORIES[0])
  const [saving, setSaving] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  function openEdit(task: Task) {
    setEditForm({
      title: task.title,
      category: task.category,
      due_date: task.due_date ?? '',
      status: task.status,
    })
    setEditingTask(task)
    setShowEditModal(true)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addingTitle.trim()) return
    setSaving(true)
    await createTask({
      title: addingTitle.trim(),
      category: addingCategory,
      due_date: addingDue || null,
      status: 'open',
      source: 'manual',
      is_recurring: false,
      recurrence_days: null,
      property_id: null,
      recurring_item_id: null,
      transaction_id: null,
    })
    setAddingTitle('')
    setAddingDue('')
    setShowAddDetails(false)
    setAddingCategory(TASK_CATEGORIES[0])
    setSaving(false)
    refetch()
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTask) return
    setSaving(true)
    await updateTask(editingTask.id, {
      title: editForm.title.trim(),
      category: editForm.category,
      due_date: editForm.due_date || null,
      status: editForm.status,
    })
    setShowEditModal(false)
    setEditingTask(null)
    setSaving(false)
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק משימה זו?')) return
    await deleteTask(id)
    refetch()
  }

  async function toggleDone(task: Task) {
    await updateTask(task.id, { status: task.status === 'done' ? 'open' : 'done' })
    refetch()
  }

  // Focus add input when it appears
  useEffect(() => {
    if (addInputRef.current) addInputRef.current.focus()
  }, [])

  return (
    <div className="page tasks-page">
      <div className="page-header">
        <h1>משימות</h1>
        <div className="toggle-group">
          <button type="button" className={`toggle-btn ${statusFilter === 'open' ? 'active' : ''}`} onClick={() => setStatusFilter('open')}>פתוחות</button>
          <button type="button" className={`toggle-btn ${statusFilter === 'done' ? 'active' : ''}`} onClick={() => setStatusFilter('done')}>הושלמו</button>
          <button type="button" className={`toggle-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>הכל</button>
        </div>
      </div>

      {loading && <div className="empty-state">טוען...</div>}
      {error && <div className="form-error">{error}</div>}

      {!loading && (
        <div className="gtasks-list">
          {tasks.map(task => (
            <div key={task.id} className={`gtask-item ${task.status === 'done' ? 'gtask-done' : ''}`}>
              <button
                className={`gtask-check ${task.status === 'done' ? 'checked' : ''}`}
                onClick={() => toggleDone(task)}
                aria-label="סמן כהושלם"
              >
                {task.status === 'done' && (
                  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              <div className="gtask-body" onClick={() => openEdit(task)}>
                <div className="gtask-title">{task.title}</div>
                <div className="gtask-meta">
                  {task.due_date && (
                    <span className={isOverdue(task) ? 'gtask-due overdue' : 'gtask-due'}>
                      {formatDate(task.due_date)}
                    </span>
                  )}
                  {task.category && <span className="gtask-cat">{task.category}</span>}
                  {task.source !== 'manual' && (
                    <span className="gtask-source-badge">
                      {task.source === 'recurring_item' ? 'קבוע' : 'חידוש'}
                    </span>
                  )}
                </div>
              </div>

              <button className="gtask-delete" onClick={() => handleDelete(task.id)} aria-label="מחק">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}

          {!loading && tasks.length === 0 && statusFilter !== 'done' && (
            <div className="gtask-empty">אין משימות פתוחות</div>
          )}
          {!loading && tasks.length === 0 && statusFilter === 'done' && (
            <div className="gtask-empty">אין משימות שהושלמו</div>
          )}

          {statusFilter !== 'done' && (
            <form className="gtask-add-form" onSubmit={handleAdd}>
              <button type="button" className="gtask-add-check" tabIndex={-1} aria-hidden />
              <div className="gtask-add-body">
                <input
                  ref={addInputRef}
                  className="gtask-add-input"
                  placeholder="הוסף משימה"
                  value={addingTitle}
                  onChange={e => setAddingTitle(e.target.value)}
                  onFocus={() => setShowAddDetails(true)}
                />
                {showAddDetails && (
                  <div className="gtask-add-details">
                    <input
                      type="date"
                      className="gtask-add-date"
                      value={addingDue}
                      onChange={e => setAddingDue(e.target.value)}
                    />
                    <select
                      className="gtask-add-cat"
                      value={addingCategory}
                      onChange={e => setAddingCategory(e.target.value)}
                    >
                      {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="gtask-add-actions">
                      <button type="submit" className="btn-primary" disabled={saving || !addingTitle.trim()}>
                        הוסף
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => {
                        setAddingTitle('')
                        setAddingDue('')
                        setShowAddDetails(false)
                      }}>ביטול</button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {showEditModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>עריכת משימה</h2>
              <button className="btn-icon" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSave} className="form">
              <div className="form-row">
                <label>כותרת</label>
                <input type="text" value={editForm.title} autoFocus
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>קטגוריה</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                  {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>תאריך יעד</label>
                <input type="date" value={editForm.due_date}
                  onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>סטטוס</label>
                <div className="toggle-group">
                  <button type="button" className={`toggle-btn ${editForm.status === 'open' ? 'active' : ''}`}
                    onClick={() => setEditForm(f => ({ ...f, status: 'open' }))}>פתוחה</button>
                  <button type="button" className={`toggle-btn ${editForm.status === 'done' ? 'active' : ''}`}
                    onClick={() => setEditForm(f => ({ ...f, status: 'done' }))}>הושלמה</button>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>ביטול</button>
                <button type="submit" className="btn-primary" disabled={saving}>שמור</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
