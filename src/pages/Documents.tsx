import { FolderOpen, FileText, Image, ShieldCheck, Receipt, File, X } from '@phosphor-icons/react'
import React, { useState, useRef } from 'react'
import { useDocuments, createDocument, deleteDocument } from '../hooks/useDocuments'
import { uploadDocument, getReceiptSignedUrl } from '../lib/storage'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '../lib/format'
import type { DocumentType } from '../types'
import { SkeletonList } from '../components/ui/Skeleton'

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

const emptyForm = {
  type: 'other' as DocumentType,
  name: '',
  date: '',
}

export default function Documents() {
  const { user } = useAuth()
  const { documents, loading, error, refetch } = useDocuments()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openNew() {
    setForm(emptyForm)
    setFile(null)
    setFormError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setFile(null)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setFormError('יש לבחור קובץ'); return }
    if (!user) return
    setSaving(true)
    setFormError(null)
    try {
      const id = crypto.randomUUID()
      const path = await uploadDocument(file, id)
      await createDocument({
        id,
        owner_id: user.id,
        property_id: null,
        contract_id: null,
        transaction_id: null,
        type: form.type,
        name: form.name.trim() || file.name,
        storage_path: path,
        date: form.date || null,
      })
      closeModal()
      refetch()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  async function handleView(path: string) {
    try {
      const url = await getReceiptSignedUrl(path)
      window.open(url, '_blank')
    } catch {
      alert('שגיאה בפתיחת הקובץ')
    }
  }

  async function handleDelete(id: string, path: string) {
    if (!confirm('למחוק מסמך זה?')) return
    await deleteDocument(id, path)
    refetch()
  }

  return (
    <div className="page documents-page">
      <div className="page-header">
        <h1>מסמכים</h1>
        <button className="btn-primary" onClick={openNew}>+ מסמך חדש</button>
      </div>

      {loading && <SkeletonList rows={4} />}
      {error && <div className="form-error">{error}</div>}

      {!loading && documents.length === 0 && (
        <div className="empty-state-cta">
          <div className="empty-state-cta-icon"><FolderOpen size={40} /></div>
          <p>עדיין לא הועלו מסמכים</p>
          <button className="btn-primary" onClick={openNew}>+ העלה מסמך</button>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div className="docs-grid">
          {documents.map(doc => (
            <div key={doc.id} className="doc-card">
              <div className="doc-icon">{docIcon(doc.type)}</div>
              <div className="doc-info">
                <div className="doc-name">{doc.name}</div>
                <div className="doc-meta">
                  <span className="doc-type-badge">{DOC_TYPE_LABELS[doc.type]}</span>
                  {doc.date && <span className="doc-date">{formatDate(doc.date)}</span>}
                </div>
              </div>
              <div className="doc-actions">
                <button className="btn-icon" onClick={() => handleView(doc.storage_path)} title="פתח">
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M10 4.5C5.5 4.5 2 10 2 10s3.5 5.5 8 5.5 8-5.5 8-5.5-3.5-5.5-8-5.5z" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                </button>
                <button className="btn-icon danger" onClick={() => handleDelete(doc.id, doc.storage_path)} title="מחק">
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>מסמך חדש</h2>
              <button className="btn-icon" onClick={closeModal} aria-label="סגור" title="סגור"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="form-row">
                <label>סוג</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DocumentType }))}>
                  {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>שם (אופציונלי)</label>
                <input
                  type="text"
                  placeholder="שם ברירת מחדל: שם הקובץ"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>תאריך (אופציונלי)</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>קובץ</label>
                <div className="file-upload">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    {file ? file.name : 'בחר קובץ'}
                  </button>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>ביטול</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function docIcon(type: DocumentType): React.ReactNode {
  switch (type) {
    case 'purchase_contract':
    case 'rental_contract': return <FileText size={26} />
    case 'property_photos': return <Image size={26} />
    case 'insurance_policy': return <ShieldCheck size={26} />
    case 'receipt':
    case 'invoice': return <Receipt size={26} />
    default: return <File size={26} />
  }
}
