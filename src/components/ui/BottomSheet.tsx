import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import './bottom-sheet.css'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/**
 * Premium mobile bottom sheet. Portals to <body> to escape the page's
 * stacking/RTL/overflow context. Bottom-anchored slide, grab handle with
 * swipe-down-to-dismiss, scrim-tap + Esc to close, body scroll-lock.
 */
export default function BottomSheet({ open, onClose, title, children }: Props) {
  // Keep mounted through the slide-out, then unmount to keep the DOM clean.
  const [mounted, setMounted] = useState(open)
  const [minimized, setMinimized] = useState(false)
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    if (open) { setMounted(true); setMinimized(false) }
    else {
      const t = setTimeout(() => setMounted(false), 360)
      return () => clearTimeout(t)
    }
  }, [open])

  // Lock background scroll only while expanded (minimized leaves the page usable).
  useEffect(() => {
    if (!open || minimized) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, minimized])

  // Esc to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  function onTouchStart(e: React.TouchEvent) { startY.current = e.touches[0].clientY }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null) return
    const delta = e.touches[0].clientY - startY.current
    // Expanded: track downward drag. Minimized: track upward drag (to restore).
    if (!minimized && delta > 0) setDragY(delta)
    else if (minimized && delta < 0) setDragY(delta)
  }
  function onTouchEnd() {
    if (!minimized && dragY > 90) setMinimized(true)
    else if (minimized && dragY < -40) setMinimized(false)
    setDragY(0)
    startY.current = null
  }

  // While dragging, follow the finger; otherwise let CSS classes drive the transform.
  const dragStyle = dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined

  return createPortal(
    <div className={`bsheet-root${open ? ' open' : ''}${minimized ? ' minimized' : ''}`}>
      <div className="bsheet-scrim" onClick={onClose} />
      <div
        className="bsheet"
        style={minimized ? undefined : dragStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="bsheet-grab"
          onClick={() => minimized && setMinimized(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="bsheet-handle" />
        </div>
        {title && (
          <div className="bsheet-head" onClick={() => minimized && setMinimized(false)}>
            <h2>{title}</h2>
            <button className="bsheet-close" onClick={e => { e.stopPropagation(); onClose() }} aria-label="סגור"><X size={20} /></button>
          </div>
        )}
        <div className="bsheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
