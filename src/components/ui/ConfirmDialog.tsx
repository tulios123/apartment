import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * In-app, themed, non-blocking confirmation dialog — replaces the native blocking
 * `confirm()` (audit UX-03). Centered portal to <body> so it escapes any page
 * stacking/RTL context; Esc / scrim-tap cancels. Used for the money follow-up after
 * completing a task, and anywhere a yes/no decision is needed.
 */
export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'אישור', cancelLabel = 'ביטול', tone = 'default',
  onConfirm, onCancel,
}: Props) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // Move focus into the dialog on open (the safe Cancel action — so a stray Enter
  // never confirms a destructive action), and restore it to the trigger on close.
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    cancelBtnRef.current?.focus()
    return () => { restoreFocusRef.current?.focus?.() }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="confirm-title">{title}</div>}
        <div className="confirm-msg">{message}</div>
        <div className="confirm-actions">
          <button
            className={`confirm-btn confirm-ok${tone === 'danger' ? ' danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button ref={cancelBtnRef} className="confirm-btn confirm-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
