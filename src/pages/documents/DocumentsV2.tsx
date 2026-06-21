import React, { useState, useRef, useMemo } from 'react'
import { FileText, Image as ImageIcon, ShieldCheck, Receipt, File, X, Plus, Eye, Trash, UploadSimple, PencilSimple } from '@phosphor-icons/react'
import { useDocuments, createDocument, updateDocument, deleteDocument } from '../../hooks/useDocuments'
import { uploadDocument, getReceiptSignedUrl } from '../../lib/storage'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate } from '../../lib/format'
import type { DocumentType } from '../../types'
import { SkeletonList } from '../../components/ui/Skeleton'
import './documents-v2.css'

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  purchase_contract: 'חוזה רכישה',
  property_photos: 'תמונות נכס',
  rental_contract: 'חוזה שכירות',
  insurance_policy: 'פוליסת ביטוח',
  receipt: 'קבלה',
  invoice: 'חשבונית',
  other: 'אחר',
}

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocumentType, string][]

// Display order for grouped sections
const TYPE_ORDER: DocumentType[] = ['purchase_contract', 'rental_contract', 'insurance_policy', 'receipt', 'invoice', 'property_photos', 'other']

const TYPE_TONE: Record<DocumentType, string> = {
  purchase_contract: 'blue', rental_contract: 'teal', insurance_policy: 'purple',
  receipt: 'amber', invoice: 'amber', property_photos: 'blue', other: 'muted',
}

const emptyForm = { type: 'other' as DocumentType, name: '', date: '' }

export default function DocumentsV2({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { documents, loading, error, refetch } = useDocuments()
  const [filter, setFilter] = useState<DocumentType | 'all'>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Which types are actually present (for filter chips)
  const presentTypes = useMemo(() => {
    const set = new Set(documents.map(d => d.type))
    return TYPE_ORDER.filter(t => set.has(t))
  }, [documents])

  const groups = useMemo(() => {
    const shown = filter === 'all' ? documents : documents.filter(d => d.type === filter)
    return TYPE_ORDER
      .map(type => ({ type, docs: shown.filter(d => d.type === type) }))
      .filter(g => g.docs.length > 0)
  }, [documents, filter])

  function openNew() { setForm(emptyForm); setFile(null); setEditingId(null); setFormError(null); setDrawerOpen(true) }
  function openEdit(doc: { id: string; type: DocumentType; name: string; date: string | null }) {
    setForm({ type: doc.type, name: doc.name, date: doc.date ?? '' })
    setFile(null); setEditingId(doc.id); setFormError(null); setDrawerOpen(true)
  }

  async function handleSubmit() {
    if (!user) return
    if (editingId) {
      if (!form.name.trim()) { setFormError('יש להזין שם'); return }
      setSaving(true); setFormError(null)
      try {
        await updateDocument(editingId, { name: form.name.trim(), type: form.type, date: form.date || null })
        setDrawerOpen(false); setEditingId(null)
        refetch()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'שגיאה בשמירה')
      } finally { setSaving(false) }
      return
    }
    if (!file) { setFormError('יש לבחור קובץ'); return }
    setSaving(true); setFormError(null)
    try {
      const id = crypto.randomUUID()
      const path = await uploadDocument(file, id)
      await createDocument({
        id, owner_id: user.id, property_id: null, contract_id: null, transaction_id: null, task_id: null,
        type: form.type, name: form.name.trim() || file.name, storage_path: path, date: form.date || null,
      })
      setDrawerOpen(false); setFile(null)
      refetch()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'שגיאה בשמירה')
    } finally { setSaving(false) }
  }

  async function handleView(path: string) {
    try { window.open(await getReceiptSignedUrl(path), '_blank') }
    catch { alert('שגיאה בפתיחת הקובץ') }
  }

  async function handleDelete(id: string, path: string) {
    await deleteDocument(id, path); setConfirmDeleteId(null); refetch()
  }

  return (
    <div className={embedded ? 'docv docv-embedded' : 'page docv'}>
      {!embedded && <div className="page-header"><h1>מסמכים</h1></div>}

      {loading && <SkeletonList rows={4} />}
      {error && <div className="form-error" role="alert">{error}</div>}

      {!loading && documents.length === 0 && (
        <div className="docv-empty">
          <div className="docv-empty-icon"><File size={30} weight="duotone" /></div>
          <p>עדיין לא הועלו מסמכים</p>
          <button className="docv-empty-btn" onClick={openNew}><UploadSimple size={17} weight="bold" /> העלה מסמך</button>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <>
          {presentTypes.length > 1 && (
            <div className="docv-filters">
              <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>הכל</button>
              {presentTypes.map(t => (
                <button key={t} className={filter === t ? 'on' : ''} onClick={() => setFilter(t)}>{DOC_TYPE_LABELS[t]}</button>
              ))}
            </div>
          )}

          {groups.map(({ type, docs }) => (
            <section key={type} className="docv-group">
              <div className="docv-group-head"><h2>{DOC_TYPE_LABELS[type]}</h2><span>{docs.length}</span></div>
              <div className="docv-grid">
                {docs.map(doc => (
                  <div key={doc.id} className="docv-card">
                    <div className={`docv-icon ${TYPE_TONE[doc.type]}`} onClick={() => handleView(doc.storage_path)} style={{ cursor: 'pointer' }}>{docIcon(doc.type)}</div>
                    <div className="docv-info" onClick={() => handleView(doc.storage_path)} style={{ cursor: 'pointer' }}>
                      <div className="docv-name">{doc.name}</div>
                      {doc.date && <div className="docv-date">{formatDate(doc.date)}</div>}
                    </div>
                    {confirmDeleteId === doc.id ? (
                      <span className="docv-confirm">
                        <button className="docv-confirm-yes" onClick={() => handleDelete(doc.id, doc.storage_path)}>מחק</button>
                        <button className="docv-confirm-no" onClick={() => setConfirmDeleteId(null)}>ביטול</button>
                      </span>
                    ) : (
                      <div className="docv-actions">
                        <button className="docv-icon-btn" onClick={() => handleView(doc.storage_path)} aria-label="פתח"><Eye size={16} /></button>
                        <button className="docv-icon-btn" onClick={() => openEdit(doc)} aria-label="שנה שם"><PencilSimple size={16} /></button>
                        <button className="docv-icon-btn danger" onClick={() => setConfirmDeleteId(doc.id)} aria-label="מחק"><Trash size={16} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <button className="docv-fab" onClick={openNew} aria-label="מסמך חדש"><Plus size={26} weight="bold" /></button>

      <div className={`docv-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`docv-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="docv-drawer-head"><h2>{editingId ? 'עריכת מסמך' : 'מסמך חדש'}</h2><button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button></div>
        <label className="docv-field"><span>סוג</span><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DocumentType }))}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="docv-field"><span>שם{editingId ? '' : ' (אופציונלי)'}</span><input type="text" placeholder="ברירת מחדל: שם הקובץ" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
        <label className="docv-field"><span>תאריך (אופציונלי)</span><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></label>
        {!editingId && (
          <div className="docv-field">
            <span>קובץ</span>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" className="docv-filepick" onClick={() => fileInputRef.current?.click()}>
              <UploadSimple size={17} /> {file ? file.name : 'בחר קובץ'}
            </button>
          </div>
        )}
        {formError && <div className="docv-form-err" role="alert">{formError}</div>}
        <button className="docv-save" disabled={saving} onClick={handleSubmit}>{saving ? 'שומר…' : 'שמירה'}</button>
      </aside>
    </div>
  )
}

function docIcon(type: DocumentType): React.ReactNode {
  switch (type) {
    case 'purchase_contract':
    case 'rental_contract': return <FileText size={24} weight="duotone" />
    case 'property_photos': return <ImageIcon size={24} weight="duotone" />
    case 'insurance_policy': return <ShieldCheck size={24} weight="duotone" />
    case 'receipt':
    case 'invoice': return <Receipt size={24} weight="duotone" />
    default: return <File size={24} weight="duotone" />
  }
}
