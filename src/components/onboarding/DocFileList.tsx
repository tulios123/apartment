import { useRef, useState } from 'react'
import { Paperclip, X, PencilSimple, Check, Plus } from '@phosphor-icons/react'

// Uploaded-files manager shared by every onboarding step's upload area: see each
// file, rename it (tap the name or the pencil), remove it, or add more. Adding runs
// the same extraction the upload button does — it's a user action, never automatic.
export function DocFileList({ files, onFiles, onRemove, onRename }: {
  files: File[]
  onFiles: (files: File[]) => void
  onRemove: (index: number) => void
  onRename: (index: number, name: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const startEdit = (i: number, name: string) => { setEditIdx(i); setDraft(name) }
  const commitEdit = () => { if (editIdx !== null) onRename(editIdx, draft); setEditIdx(null) }

  if (files.length === 0) return null
  return (
    <div className="onboarding-doc-files onboarding-doc-files--inline">
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="onboarding-doc-file">
          <Paperclip size={15} weight="bold" />
          {editIdx === i ? (
            <input
              className="onboarding-doc-file-edit"
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                if (e.key === 'Escape') setEditIdx(null)
              }}
            />
          ) : (
            <span className="onboarding-doc-file-name" onClick={() => startEdit(i, f.name)}>{f.name}</span>
          )}
          {editIdx === i ? (
            <button type="button" className="onboarding-doc-file-del" onMouseDown={e => e.preventDefault()} onClick={commitEdit} aria-label="שמירת שם">
              <Check size={15} weight="bold" />
            </button>
          ) : (
            <>
              <button type="button" className="onboarding-doc-file-del" onClick={() => startEdit(i, f.name)} aria-label={`שינוי שם ${f.name}`}>
                <PencilSimple size={14} weight="bold" />
              </button>
              <button type="button" className="onboarding-doc-file-del" onClick={() => onRemove(i)} aria-label={`הסרת ${f.name}`}>
                <X size={14} weight="bold" />
              </button>
            </>
          )}
        </div>
      ))}
      <button type="button" className="onboarding-doc-file-add" onClick={() => ref.current?.click()}>
        <Plus size={15} weight="bold" /> הוספת קובץ
      </button>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
        onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) onFiles(fs); e.target.value = '' }} />
    </div>
  )
}
