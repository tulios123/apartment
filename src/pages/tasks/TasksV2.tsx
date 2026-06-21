import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Check, PencilSimple, Trash, Wrench, MagnifyingGlass, ListChecks, ClipboardText, Paperclip, Eye } from '@phosphor-icons/react'
import { useTasks, createTask, updateTask, deleteTask } from '../../hooks/useTasks'
import { useDocuments, createDocument, deleteDocument } from '../../hooks/useDocuments'
import { uploadDocument, redirectToSignedUrl } from '../../lib/storage'
import { useAuth } from '../../contexts/AuthContext'
import { TASK_CATEGORIES, RENT_CATEGORIES } from '../../lib/constants'
import { formatDate, todayISO } from '../../lib/format'
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

const todayStr = () => todayISO()

function isOverdue(t: Task) {
  if (!t.due_date || t.status === 'done') return false
  return t.due_date < todayStr()
}

export default function TasksV2({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tasks, setTasks, loading, error, refetch } = useTasks({ status: 'all' })
  const { documents, refetch: refetchDocs } = useDocuments()

  const [editing, setEditing] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState(emptyEdit)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingTitle, setAddingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const taskDocs = editing ? documents.filter(d => d.task_id === editing.id) : []

  async function handleAttach(file: File) {
    if (!user || !editing) return
    setAttaching(true)
    try {
      const id = crypto.randomUUID()
      const path = await uploadDocument(file, id)
      await createDocument({
        id, owner_id: user.id, property_id: null, contract_id: null, transaction_id: null, task_id: editing.id,
        type: 'other', name: file.name, storage_path: path, date: null,
      })
      await refetchDocs()
    } catch { /* upload failed — leave the task untouched */ }
    finally { setAttaching(false) }
  }

  function openDoc(path: string) {
    const w = window.open('', '_blank')
    redirectToSignedUrl(w, path)
  }

  async function removeDoc(id: string, path: string) {
    await deleteDocument(id, path); refetchDocs()
  }

  // Backlog = every open task (dated ones carry a quiet chip).
  // Logbook = completed tasks, most-recently-closed first.
  const { backlog, logbook } = useMemo(() => {
    const backlog = tasks.filter(t => t.status !== 'done')
    const logbook = tasks
      .filter(t => t.status === 'done')
      .sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at))
    return { backlog, logbook }
  }, [tasks])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addingTitle.trim()) return
    setSaving(true)
    await createTask({
      title: addingTitle.trim(), category: 'כללי', due_date: null,
      status: 'open', source: 'manual', is_recurring: false, recurrence_days: null,
      property_id: null, recurring_item_id: null, transaction_id: null,
    })
    setAddingTitle('')
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
    // Optimistic: flip locally first so the tap feels instant; persist in the
    // background and only reload if the write fails.
    setTasks(prev => prev.map(x => x.id === t.id
      ? { ...x, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
      : x))
    updateTask(t.id, { status: newStatus }).then(r => { if (r.error) refetch() })
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
      {!embedded && <div className="page-header"><h1>משימות</h1></div>}

      {loading && <SkeletonList rows={4} />}
      {error && <div className="form-error" role="alert">{error}</div>}

      {!loading && (
        <>
          {/* ── Open backlog ─────────────────────────────────────── */}
          <section className="tav-section">
            <form className="tav-quickadd" onSubmit={handleAdd}>
              <Plus size={18} className="tav-quickadd-icon" />
              <input
                className="tav-quickadd-input"
                placeholder="הקלד משימה ולחץ Enter…"
                value={addingTitle}
                onChange={e => setAddingTitle(e.target.value)}
              />
            </form>

            <div className="tav-section-head">
              <span className="tav-bucket-dot accent" />
              <h2>משימות פתוחות</h2>
              {backlog.length > 0 && <span className="tav-bucket-count">{backlog.length}</span>}
            </div>

            {backlog.length === 0 ? (
              <div className="tav-empty"><Check size={28} weight="bold" /><p>אין משימות פתוחות — הכול תחת שליטה</p></div>
            ) : backlog.map(t => {
              const Icon = CAT_ICON[t.category] ?? ListChecks
              const overdue = isOverdue(t)
              return (
                <div key={t.id} className="tav-task tav-task-lg">
                  <button className="tav-check" onClick={() => toggleDone(t)} aria-label="סמן כהושלם" />
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

          {/* ── Maintenance logbook (completed) ──────────────────── */}
          {logbook.length > 0 && (
            <section className="tav-section tav-logbook">
              <div className="tav-section-head">
                <ClipboardText size={16} weight="duotone" color="var(--text-muted)" />
                <h2>יומן תחזוקה</h2>
                <span className="tav-bucket-count">{logbook.length}</span>
              </div>
              {logbook.map(t => {
                const Icon = CAT_ICON[t.category] ?? ListChecks
                const stamp = t.completed_at ?? t.created_at
                return (
                  <div key={t.id} className="tav-task tav-log-row">
                    <button className="tav-check on" onClick={() => toggleDone(t)} aria-label="החזר לפתוחות"><Check size={13} weight="bold" /></button>
                    <div className="tav-task-body" onClick={() => openEdit(t)} style={{ cursor: 'pointer' }}>
                      <div className="tav-task-title">{t.title}</div>
                      <div className="tav-task-meta">
                        <span className="tav-task-cat"><Icon size={13} weight="duotone" /> {t.category}</span>
                      </div>
                    </div>
                    <span className="tav-log-stamp">נסגר {formatDate(stamp.slice(0, 10))}</span>
                  </div>
                )
              })}
            </section>
          )}
        </>
      )}

      {/* Edit drawer */}
      <div className={`tav-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`tav-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="tav-drawer-head"><h2>עריכת משימה</h2><button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button></div>
        <label className="tav-field"><span>כותרת</span><input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></label>
        <label className="tav-field"><span>קטגוריה</span><select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>{TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <div className="tav-field">
          <span>תאריך יעד</span>
          <div className="tav-daterow">
            <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
            {editForm.due_date && <button type="button" className="tav-dateclear" onClick={() => setEditForm(f => ({ ...f, due_date: '' }))} aria-label="הסר תאריך"><X size={16} /></button>}
          </div>
        </div>
        <div className="tav-field">
          <span>סטטוס</span>
          <div className="tav-seg">
            <button className={editForm.status === 'open' ? 'on' : ''} onClick={() => setEditForm(f => ({ ...f, status: 'open' }))}>פתוחה</button>
            <button className={editForm.status === 'done' ? 'on' : ''} onClick={() => setEditForm(f => ({ ...f, status: 'done' }))}>הושלמה</button>
          </div>
        </div>
        <div className="tav-field">
          <span>מסמכים ותמונות</span>
          {taskDocs.length > 0 && (
            <div className="tav-doclist">
              {taskDocs.map(d => (
                <div key={d.id} className="tav-docrow">
                  <button type="button" className="tav-docname" onClick={() => openDoc(d.storage_path)}><Eye size={14} /> {d.name}</button>
                  <button type="button" className="tav-docdel" onClick={() => removeDoc(d.id, d.storage_path)} aria-label="הסר"><Trash size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf,.heic" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleAttach(f); e.target.value = '' }} />
          <button type="button" className="tav-attach" disabled={attaching} onClick={() => fileRef.current?.click()}>
            <Paperclip size={15} /> {attaching ? 'מעלה…' : 'צרף מסמך/תמונה'}
          </button>
        </div>
        <button className="tav-save" disabled={saving} onClick={handleEditSave}>{saving ? 'שומר…' : 'שמירה'}</button>
      </aside>
    </div>
  )
}
