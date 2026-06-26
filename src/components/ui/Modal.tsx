import { useEffect, useRef, type ReactNode } from 'react'
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
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    document.body.classList.add('modal-open')
    // UX-05: restore focus to the trigger when the modal closes.
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    return () => {
      document.body.classList.remove('modal-open')
      restoreFocusRef.current?.focus?.()
    }
  }, [])

  // Esc to close (UX-05 — modals must offer a clear keyboard dismiss).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
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
