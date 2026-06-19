import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Check, PencilSimple, Trash, Wrench, MagnifyingGlass, ListChecks, Warning } from '@phosphor-icons/react'
import { useTasks, createTask, updateTask, deleteTask } from '../../hooks/useTasks'
import { TASK_CATEGORIES, RENT_CATEGORIES } from '../../lib/constants'
import { formatDate } from '../../lib/format'
import type { Task } from '../../types'
import { SkeletonList } from '../../components/ui/Skeleton'
import './tasks-v2.css'

const REPAIR_CATEGORY = 'תיקונים ותחזוקה'

const CAT_ICON: Record<string, typeof Wrench> = {
  'תיקונים ותחזוקה': Wrench,
  'ביקור ובדיקה': MagnifyingGlass,
  'כללי': ListChecks,
}

const emptyEdit = { title: '', category: TASK_CATEGORIES[0] as string, due_date: '', status: 'open' as Task['status'] }

const todayStr = () => new Date().toISOString().slice(0, 10)

function isOverdue(t: Task) {
  if (!t.due_date || t.status === 'done') return false
  return t.due_date < todayStr()
}

type Bucket = { key: string; label: string; tone: string; tasks: Task[] }

export default function TasksV2({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<'open' | 'done' | 'all'>('open')
  const { tasks, loading, error, syncError, refetch } = useTasks({ status: statusFilter })

  const [editing, setEditing] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState(emptyEdit)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [addingTitle, setAddingTitle] = useState('')
  const [addingDue, setAddingDue] = useState('')
  const [addingCategory, setAddingCategory] = useState<string>(TASK_CATEGORIES[0])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const buckets = useMemo<Bucket[]>(() => {
    const today = todayStr()
    const weekAhead = new Date(); weekAhead.setDate(weekAhead.getDate() + 7)
    const weekStr = weekAhead.toISOString().slice(0, 10)

    const overdue: Task[] = [], todayT: Task[] = [], soon: Task[] = [], later: Task[] = [], noDate: Task[] = [], done: Task[] = []
    for (const t of tasks) {
      if (t.status === 'done') { done.push(t); continue }
      if (!t.due_date) { noDate.push(t); continue }
      if (t.due_date < today) overdue.push(t)
      else if (t.due_date === today) todayT.push(t)
      else if (t.due_date <= weekStr) soon.push(t)
      else later.push(t)
    }
    return [
      { key: 'overdue', label: 'באיחור', tone: 'danger', tasks: overdue },
      { key: 'today', label: 'היום', tone: 'accent', tasks: todayT },
      { key: 'soon', label: 'השבוע', tone: 'warning', tasks: soon },
      { key: 'later', label: 'בהמשך', tone: 'muted', tasks: later },
      { key: 'noDate', label: 'ללא תאריך', tone: 'muted', tasks: noDate },
      { key: 'done', label: 'הושלמו', tone: 'success', tasks: done },
    ].filter(b => b.tasks.length > 0)
  }, [tasks])

  const openCount = tasks.filter(t => t.status !== 'done').length

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addingTitle.trim()) return
    setSaving(true)
    await createTask({
      title: addingTitle.trim(), category: addingCategory, due_date: addingDue || null,
      status: 'open', source: 'manual', is_recurring: false, recurrence_days: null,
      property_id: null, recurring_item_id: null, transaction_id: null,
    })
    setAddingTitle(''); setAddingDue(''); setAddingCategory(TASK_CATEGORIES[0])
    setSaving(false)
    refetch()
  }

  function openEdit(t: Task) {
    setEditForm({ title: t.title, category: t.category, due_date: t.due_date ?? '', status: t.status })
    setEditing(t); setDrawerOpen(true)
  }

  async function handleEditSave() {
    if (!editing) return
    setSaving(true)
    await updateTask(editing.id, {
      title: editForm.title.trim(), category: editForm.category,
      due_date: editForm.due_date || null, status: editForm.status,
    })
    setDrawerOpen(false); setEditing(null); setSaving(false)
    refetch()
  }

  async function handleDelete(id: string) {
    await deleteTask(id); setConfirmDeleteId(null); refetch()
  }

  async function toggleDone(t: Task) {
    const newStatus = t.status === 'done' ? 'open' : 'done'
    await updateTask(t.id, { status: newStatus })
    refetch()
    if (newStatus === 'done' && t.category === REPAIR_CATEGORY) {
      if (confirm('המשימה הושלמה. להזין הוצאת תיקון עבור משימה זו?')) {
        navigate('/finances', { state: { prefill: { direction: 'expense', category: 'תיקונים', description: t.title } } })
      }
    }
    if (newStatus === 'done' && t.source === 'recurring_item' && t.title.startsWith('גביית')) {
      if (confirm('המשימה הושלמה. להזין קבלת שכר דירה?')) {
        navigate('/finances', { state: { prefill: { direction: 'income', category: RENT_CATEGORIES[0], description: t.title } } })
      }
    }
  }

  return (
    <div className={embedded ? 'tav tav-embedded' : 'page tav'}>
      <div className="page-header">
        {!embedded && <h1>משימות</h1>}
        <div className="tav-filter">
          <button className={statusFilter === 'open' ? 'on' : ''} onClick={() => setStatusFilter('open')}>פתוחות{openCount > 0 && statusFilter === 'open' ? ` · ${openCount}` : ''}</button>
          <button className={statusFilter === 'done' ? 'on' : ''} onClick={() => setStatusFilter('done')}>הושלמו</button>
          <button className={statusFilter === 'all' ? 'on' : ''} onClick={() => setStatusFilter('all')}>הכל</button>
        </div>
      </div>

      {loading && <SkeletonList rows={4} />}
      {error && <div className="form-error" role="alert">{error}</div>}
      {syncError && <div className="tav-sync-warn"><Warning size={15} weight="fill" /> סנכרון Google נכשל — יש להתחבר מחדש כדי לסנכרן</div>}

      {/* Inline quick-add (only when not viewing the done-only list) */}
      {!loading && statusFilter !== 'done' && (
        <form className="tav-quickadd" onSubmit={handleAdd}>
          <Plus size={18} className="tav-quickadd-icon" />
          <input
            ref={addInputRef}
            className="tav-quickadd-input"
            placeholder="הוסף משימה…"
            value={addingTitle}
            onChange={e => setAddingTitle(e.target.value)}
          />
          {addingTitle.trim() && (
            <div className="tav-quickadd-extra">
              <input type="date" value={addingDue} onChange={e => setAddingDue(e.target.value)} />
              <select value={addingCategory} onChange={e => setAddingCategory(e.target.value)}>
                {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="submit" className="tav-quickadd-go" disabled={saving}>הוסף</button>
            </div>
          )}
        </form>
      )}

      {!loading && buckets.length === 0 && (
        <div className="tav-empty">
          <Check size={30} weight="bold" />
          <p>{statusFilter === 'done' ? 'אין משימות שהושלמו' : 'אין משימות פתוחות — הכול תחת שליטה'}</p>
        </div>
      )}

      {!loading && buckets.map(b => (
        <section key={b.key} className="tav-bucket">
          <div className="tav-bucket-head">
            <span className={`tav-bucket-dot ${b.tone}`} />
            <h2>{b.label}</h2>
            <span className="tav-bucket-count">{b.tasks.length}</span>
          </div>
          {b.tasks.map(t => {
            const Icon = CAT_ICON[t.category] ?? ListChecks
            const done = t.status === 'done'
            const overdue = isOverdue(t)
            return (
              <div key={t.id} className={`tav-task${done ? ' done' : ''}`}>
                <button className={`tav-check${done ? ' on' : ''}`} onClick={() => toggleDone(t)} aria-label="סמן כהושלם">
                  {done && <Check size={13} weight="bold" />}
                </button>
                <div className="tav-task-body" onClick={() => openEdit(t)}>
                  <div className="tav-task-title">{t.title}</div>
                  <div className="tav-task-meta">
                    <span className="tav-task-cat"><Icon size={13} weight="duotone" /> {t.category}</span>
                    {t.due_date && <span className={`tav-task-due${overdue ? ' overdue' : ''}`}>{formatDate(t.due_date)}</span>}
                    {t.source !== 'manual' && <span className="tav-task-badge">{t.source === 'recurring_item' ? 'קבוע' : 'חידוש'}</span>}
                  </div>
                </div>
                {confirmDeleteId === t.id ? (
                  <span className="tav-confirm">
                    <button className="tav-confirm-yes" onClick={() => handleDelete(t.id)}>מחק</button>
                    <button className="tav-confirm-no" onClick={() => setConfirmDeleteId(null)}>ביטול</button>
                  </span>
                ) : (
                  <div className="tav-task-actions">
                    <button className="tav-icon-btn" onClick={() => openEdit(t)} aria-label="עריכה"><PencilSimple size={15} /></button>
                    <button className="tav-icon-btn danger" onClick={() => setConfirmDeleteId(t.id)} aria-label="מחק"><Trash size={15} /></button>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}

      {/* Edit drawer */}
      <div className={`tav-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`tav-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="tav-drawer-head"><h2>עריכת משימה</h2><button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button></div>
        <label className="tav-field"><span>כותרת</span><input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></label>
        <label className="tav-field"><span>קטגוריה</span><select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>{TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="tav-field"><span>תאריך יעד</span><input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} /></label>
        <div className="tav-field">
          <span>סטטוס</span>
          <div className="tav-seg">
            <button className={editForm.status === 'open' ? 'on' : ''} onClick={() => setEditForm(f => ({ ...f, status: 'open' }))}>פתוחה</button>
            <button className={editForm.status === 'done' ? 'on' : ''} onClick={() => setEditForm(f => ({ ...f, status: 'done' }))}>הושלמה</button>
          </div>
        </div>
        <button className="tav-save" disabled={saving} onClick={handleEditSave}>{saving ? 'שומר…' : 'שמירה'}</button>
      </aside>
    </div>
  )
}
