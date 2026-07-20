import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Lightbulb } from '@phosphor-icons/react'
import { pushEditContext } from '../../lib/editContext'
import { openFeedback } from '../../lib/feedbackController'

/**
 * App modal. Rendered through a portal on <body> and, while open, releases the
 * mobile body-scroll lock (`modal-open`) so the sheet scrolls the *document*
 * natively — exactly like the Onboarding flow. iOS (especially a standalone
 * PWA) handles native document scroll + keyboard auto-scroll reliably, whereas
 * a position:fixed overlay trapped inside the locked shell does not.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Register this editor as the "open edit" so a feedback note written here records
  // exactly what was being edited (see lib/editContext + FeedbackButton).
  useEffect(() => pushEditContext(title), [title])

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

  // UX-05: trap Tab within the modal so focus can't wander to the page behind it —
  // backing the aria-modal promise (mirrors BottomSheet's trapTab).
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !modalRef.current) return
    const f = modalRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (f.length === 0) return
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} onKeyDown={trapTab}>
        {/* Feedback lives in the LEADING corner and close in the TRAILING corner —
            opposite ends, so a reach for one can't slip onto the other (they used to
            sit 2px apart in the same corner). */}
        <div className="modal-header">
          <button className="btn-icon modal-feedback-btn" onClick={openFeedback} aria-label="דיווח על תקלה או רעיון" title="דיווח"><Lightbulb size={17} weight="fill" /></button>
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="סגור" title="סגור"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
