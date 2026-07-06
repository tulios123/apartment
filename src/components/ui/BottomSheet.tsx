import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { pushEditContext } from '../../lib/editContext'
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
  /**
   * Whether this sheet registers itself as the "open edit" for feedback context
   * (see lib/editContext). Defaults to true. The feedback sheet passes `false` so
   * it doesn't record *itself* as the thing the note is about.
   */
  track?: boolean
}

/**
 * Premium mobile bottom sheet. Portals to <body> to escape the page's
 * stacking/RTL/overflow context. Bottom-anchored slide, grab handle with
 * swipe-down-to-dismiss, scrim-tap + Esc to close, body scroll-lock.
 */
export default function BottomSheet({ open, onClose, title, children, minimizable = true, track = true }: Props) {
  // Keep mounted through the slide-out, then unmount to keep the DOM clean.
  const [mounted, setMounted] = useState(open)
  const [minimized, setMinimized] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [kbInset, setKbInset] = useState(0)
  const startY = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // UX-05: remember what had focus when the sheet opened and restore it on close,
  // so keyboard/VoiceOver users aren't dumped at the top of the page.
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    return () => { restoreFocusRef.current?.focus?.() }
  }, [open])

  // Register as the "open edit" so a feedback note written over this sheet records it
  // (see lib/editContext). Opted out by the feedback sheet itself via track={false}.
  useEffect(() => {
    if (open && track) return pushEditContext(title)
  }, [open, track, title])

  // UX-05: trap Tab within the sheet so focus can't wander to the page behind it.
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !sheetRef.current) return
    const f = sheetRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (f.length === 0) return
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

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

  // UX-02: a scrim-tap / Esc shouldn't silently discard typed data. When the sheet
  // is minimizable (i.e. it holds data worth keeping — ExpenseSheet passes this only
  // once the form has input) dock it instead of closing; otherwise close outright.
  const dismiss = useCallback(() => {
    if (minimizable && !minimized) setMinimized(true)
    else onClose()
  }, [minimizable, minimized, onClose])

  // Esc to dismiss.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

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
      <div className="bsheet-scrim" onClick={dismiss} />
      <div
        ref={sheetRef}
        className="bsheet"
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={trapTab}
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
