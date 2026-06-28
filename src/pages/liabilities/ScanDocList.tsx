import { useState } from 'react'
import { Paperclip, X, PencilSimple, Check, Plus } from '@phosphor-icons/react'
import type { Document } from '../../types'

// Saved-document manager for the financing editor's AI scan: see each uploaded
// statement, open it, rename it, delete it, or add another (which scans it too).
// Document-backed (not in-memory File[]) so rename/delete persist directly — the
// documents store is the single source of truth, no File↔row sync to drift.
export function ScanDocList({ docs, busy, addLabel, onOpen, onRename, onRemove, onAdd }: {
  docs: Document[]
  busy: boolean
  addLabel: string
  onOpen: (path: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string, path: string) => void
  onAdd: () => void
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const startEdit = (id: string, name: string) => { setEditId(id); setDraft(name) }
  const commit = () => { if (editId && draft.trim()) onRename(editId, draft.trim()); setEditId(null) }

  return (
    <div className="onboarding-doc-files onboarding-doc-files--inline" style={{ marginTop: 8 }}>
      {docs.map(d => (
        <div key={d.id} className="onboarding-doc-file">
          <Paperclip size={15} weight="bold" />
          {editId === d.id ? (
            <input
              className="onboarding-doc-file-edit"
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commit() }
                if (e.key === 'Escape') setEditId(null)
              }}
            />
          ) : (
            <span className="onboarding-doc-file-name" onClick={() => onOpen(d.storage_path)}>{d.name}</span>
          )}
          {editId === d.id ? (
            <button type="button" className="onboarding-doc-file-del" onMouseDown={e => e.preventDefault()} onClick={commit} aria-label="שמירת שם">
              <Check size={15} weight="bold" />
            </button>
          ) : (
            <>
              <button type="button" className="onboarding-doc-file-del" onClick={() => startEdit(d.id, d.name)} aria-label={`שינוי שם ${d.name}`}>
                <PencilSimple size={14} weight="bold" />
              </button>
              <button type="button" className="onboarding-doc-file-del" onClick={() => onRemove(d.id, d.storage_path)} aria-label={`הסרת ${d.name}`}>
                <X size={14} weight="bold" />
              </button>
            </>
          )}
        </div>
      ))}
      <button type="button" className="onboarding-doc-file-add" onClick={onAdd} disabled={busy}>
        <Plus size={15} weight="bold" /> {busy ? 'קורא את המסמך…' : addLabel}
      </button>
    </div>
  )
}
