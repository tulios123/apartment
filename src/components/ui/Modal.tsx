import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'

/**
 * App modal. Rendered through a portal on <body> and, while open, releases the
 * mobile body-scroll lock (`modal-open`) so the sheet scrolls the *document*
 * natively — exactly like the Onboarding flow. iOS (especially a standalone
 * PWA) handles native document scroll + keyboard auto-scroll reliably, whereas
 * a position:fixed overlay trapped inside the locked shell does not.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="סגור" title="סגור"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
