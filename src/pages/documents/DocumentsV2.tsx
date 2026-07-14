import React, { useState, useRef, useMemo } from 'react'
import { FileText, Image as ImageIcon, ShieldCheck, Receipt, File, Bank, X, Plus, Eye, Trash, UploadSimple, PencilSimple, FolderOpen, Certificate, CheckCircle } from '@phosphor-icons/react'
import { useDocuments, createDocument, updateDocument, deleteDocument } from '../../hooks/useDocuments'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useMortgageData } from '../../hooks/useMortgageData'
import { useLoansData } from '../../hooks/useLoansData'
import { uploadDocument, redirectToSignedUrl } from '../../lib/storage'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate } from '../../lib/format'
import type { DocumentType } from '../../types'
import { SkeletonList } from '../../components/ui/Skeleton'
import './documents-v2.css'
import { DateField } from '../../components/ui/DateField'

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  purchase_contract: 'חוזה רכישה',
  tabu_extract: 'נסח טאבו',
  property_photos: 'תמונות נכס',
  rental_contract: 'חוזה שכירות',
  insurance_policy: 'פוליסת ביטוח',
  mortgage_statement: 'משכנתא',
  loan_statement: 'הלוואה',
  receipt: 'קבלה',
  invoice: 'חשבונית',
  other: 'אחר',
}

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocumentType, string][]

// Open-ended piles (naturally many, optional) — shown as small folders, not expected "slots".
const COLLECTIONS: DocumentType[] = ['receipt', 'invoice', 'property_photos', 'other']

const TYPE_TONE: Record<DocumentType, string> = {
  purchase_contract: 'blue', tabu_extract: 'blue', rental_contract: 'teal', insurance_policy: 'purple',
  mortgage_statement: 'blue', loan_statement: 'teal',
  receipt: 'amber', invoice: 'amber', property_photos: 'blue', other: 'muted',
}

const emptyForm = { type: 'other' as DocumentType, name: '', date: '' }

export default function DocumentsV2({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { documents, loading, error, refetch } = useDocuments()
  // The property's real situation drives which key documents are EXPECTED — so we only ask
  // for what actually applies (a rental contract only if it's rented, a mortgage doc only if
  // there's a mortgage, etc.). That's the "it knows what you haven't uploaded" part.
  const { contracts } = usePropertyData()
  const { mortgage, tracks } = useMortgageData()
  const { loans } = useLoansData()
  const [filter, setFilter] = useState<DocumentType | 'all'>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The KEY documents a property owner should have on file. Universal ones always show; the
  // contextual ones appear only when the property actually has that thing.
  const keySlots = useMemo<DocumentType[]>(() => {
    const slots: DocumentType[] = ['tabu_extract', 'purchase_contract']
    if (contracts.length > 0) slots.push('rental_contract')
    if (mortgage != null || tracks.length > 0) slots.push('mortgage_statement')
    if (loans.length > 0) slots.push('loan_statement')
    slots.push('insurance_policy')
    return slots
  }, [contracts.length, mortgage, tracks.length, loans.length])

  const filledCount = useMemo(
    () => keySlots.filter(t => documents.some(d => d.type === t)).length,
    [keySlots, documents],
  )

  const filteredDocs = useMemo(
    () => (filter === 'all' ? [] : documents.filter(d => d.type === filter)),
    [documents, filter],
  )

  function openNew(type: DocumentType = emptyForm.type) { setForm({ ...emptyForm, type }); setFile(null); setEditingId(null); setFormError(null); setDrawerOpen(true) }
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

  function handleView(path: string) {
    const w = window.open('', '_blank')
    redirectToSignedUrl(w, path)
  }

  async function handleDelete(id: string, path: string) {
    setActionErr(null)
    try {
      await deleteDocument(id, path)
    } catch {
      setActionErr('מחיקת המסמך נכשלה — נסו שוב')
    } finally {
      setConfirmDeleteId(null)
      refetch()
    }
  }

  // Tap a slot: empty → upload for that type; one doc → open it; several → browse them.
  function openSlot(type: DocumentType) {
    const docs = documents.filter(d => d.type === type)
    if (docs.length === 0) { openNew(type); return }
    if (docs.length === 1) { handleView(docs[0].storage_path); return }
    setFilter(type)
  }

  return (
    <div className={embedded ? 'docv docv-embedded' : 'page docv'}>
      {!embedded && <div className="page-header"><h1>מסמכים</h1></div>}

      {loading && <SkeletonList rows={4} />}
      {error && <div className="form-error" role="alert">{error}</div>}
      {actionErr && <div className="form-error" role="alert">{actionErr}</div>}

      {!loading && filter === 'all' && (
        <>
          {/* ── Key document slots — the file every owner should complete ── */}
          <section className="docv-slots" aria-label="מסמכי הנכס">
            <div className="docv-section-head">
              <h2>מסמכי הנכס</h2>
              <span className="docv-progress">{filledCount}/{keySlots.length}</span>
            </div>
            <div className="docv-slots-grid">
              {keySlots.map(type => {
                const n = documents.filter(d => d.type === type).length
                const filled = n > 0
                return (
                  <button
                    key={type}
                    type="button"
                    className={`docv-slot ${filled ? 'filled' : 'empty'} ${TYPE_TONE[type]}`}
                    onClick={() => openSlot(type)}
                  >
                    <span className="docv-slot-icon">{docIcon(type)}</span>
                    <span className="docv-slot-body">
                      <span className="docv-slot-label">{DOC_TYPE_LABELS[type]}</span>
                      <span className="docv-slot-status">{filled ? (n > 1 ? `${n} מסמכים` : 'קיים') : 'חסר — העלה'}</span>
                    </span>
                    <span className="docv-slot-badge">
                      {filled ? <CheckCircle size={18} weight="fill" /> : <UploadSimple size={15} weight="bold" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Collections — open-ended piles ── */}
          <section className="docv-collections" aria-label="אוספים">
            <div className="docv-section-head"><h2>אוספים</h2></div>
            <div className="docv-coll-row">
              {COLLECTIONS.map(type => {
                const n = documents.filter(d => d.type === type).length
                return (
                  <button
                    key={type}
                    type="button"
                    className="docv-coll"
                    onClick={() => (n > 0 ? setFilter(type) : openNew(type))}
                  >
                    <span className={`docv-coll-icon ${TYPE_TONE[type]}`}>{docIcon(type)}</span>
                    <span className="docv-coll-label">{DOC_TYPE_LABELS[type]}</span>
                    <span className="docv-coll-n">{n > 0 ? n : '+'}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* ── Browse one type's documents (after tapping a slot/collection) ── */}
      {!loading && filter !== 'all' && (
        <section className="docv-group">
          <div className="docv-group-head">
            <button type="button" className="docv-back" onClick={() => setFilter('all')}>← כל המסמכים</button>
            <h2>{DOC_TYPE_LABELS[filter]}</h2>
            <span>{filteredDocs.length}</span>
          </div>
          {filteredDocs.length === 0 ? (
            <div className="docv-empty">
              <div className="empty-flat-icon"><FolderOpen size={30} weight="duotone" /></div>
              <p>אין עדיין {DOC_TYPE_LABELS[filter]}</p>
              <button className="docv-empty-btn" onClick={() => openNew(filter)}><UploadSimple size={17} weight="bold" /> העלה</button>
            </div>
          ) : (
            <div className="docv-grid">
              {filteredDocs.map(doc => (
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
          )}
        </section>
      )}

      <button className="docv-fab" onClick={() => openNew()} aria-label="מסמך חדש"><Plus size={26} weight="bold" /></button>

      <div className={`docv-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`docv-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="docv-drawer-head"><h2>{editingId ? 'עריכת מסמך' : 'מסמך חדש'}</h2><button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button></div>
        <div className="docv-drawer-body">
        <label className="docv-field"><span>סוג</span><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DocumentType }))}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="docv-field"><span>שם{editingId ? '' : ' (אופציונלי)'}</span><input type="text" placeholder="ברירת מחדל: שם הקובץ" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
        <label className="docv-field"><span>תאריך (אופציונלי)</span><DateField value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} ariaLabel="תאריך" /></label>
        {!editingId && (
          <div className="docv-field">
            <span>קובץ</span>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" className="docv-filepick" onClick={() => fileInputRef.current?.click()}>
              <UploadSimple size={17} /> {file ? file.name : 'בחרו קובץ'}
            </button>
          </div>
        )}
        {formError && <div className="docv-form-err" role="alert">{formError}</div>}
        </div>
        <button className="docv-save" disabled={saving} onClick={handleSubmit}>{saving ? 'שומר…' : 'שמירה'}</button>
      </aside>
    </div>
  )
}

function docIcon(type: DocumentType): React.ReactNode {
  switch (type) {
    case 'purchase_contract':
    case 'rental_contract': return <FileText size={24} weight="duotone" />
    case 'tabu_extract': return <Certificate size={24} weight="duotone" />
    case 'property_photos': return <ImageIcon size={24} weight="duotone" />
    case 'insurance_policy': return <ShieldCheck size={24} weight="duotone" />
    case 'mortgage_statement':
    case 'loan_statement': return <Bank size={24} weight="duotone" />
    case 'receipt':
    case 'invoice': return <Receipt size={24} weight="duotone" />
    default: return <File size={24} weight="duotone" />
  }
}
