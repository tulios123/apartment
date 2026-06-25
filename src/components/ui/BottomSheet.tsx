import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import './bottom-sheet.css'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /**
   * What a swipe-down past the threshold does. `true` (default) docks the sheet
   * at the bottom (minimized, page usable) so in-progress input is preserved;
   * `false` closes it outright. Pass a dynamic value to only keep the sheet when
   * the form actually holds data (see ExpenseSheet).
   */
  minimizable?: boolean
}

/**
 * Premium mobile bottom sheet. Portals to <body> to escape the page's
 * stacking/RTL/overflow context. Bottom-anchored slide, grab handle with
 * swipe-down-to-dismiss, scrim-tap + Esc to close, body scroll-lock.
 */
export default function BottomSheet({ open, onClose, title, children, minimizable = true }: Props) {
  // Keep mounted through the slide-out, then unmount to keep the DOM clean.
  const [mounted, setMounted] = useState(open)
  const [minimized, setMinimized] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [kbInset, setKbInset] = useState(0)
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

  // Lift the sheet above the soft keyboard. On iOS the keyboard overlays a
  // bottom-anchored fixed element (it doesn't reflow the layout viewport), so a
  // focused input would otherwise hide the primary action. visualViewport tells
  // us the occluded height; we pad the sheet bottom by it. No-op where unsupported.
  useEffect(() => {
    const vv = window.visualViewport
    if (!open || minimized || !vv) { setKbInset(0); return }
    const update = () => setKbInset(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [open, minimized])

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
    // Past the downward threshold: dock the sheet if it's allowed to stay
    // (preserves typed-in data), otherwise just close it.
    if (!minimized && dragY > 90) { if (minimizable) setMinimized(true); else onClose() }
    else if (minimized && dragY < -40) setMinimized(false)
    setDragY(0)
    startY.current = null
  }

  // While dragging, follow the finger; otherwise let CSS classes drive the transform.
  // Layer the keyboard inset on top so a focused input never hides the action button.
  const sheetStyle: React.CSSProperties | undefined = minimized
    ? undefined
    : {
        ...(dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : null),
        ...(kbInset > 0 ? { paddingBottom: kbInset + 16 } : null),
      }

  return createPortal(
    <div className={`bsheet-root${open ? ' open' : ''}${minimized ? ' minimized' : ''}`}>
      <div className="bsheet-scrim" onClick={onClose} />
      <div
        className="bsheet"
        style={sheetStyle}
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
