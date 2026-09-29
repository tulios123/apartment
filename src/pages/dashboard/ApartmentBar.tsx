import { useEffect, useRef, useState } from 'react'
import { House, CaretDown, Eye } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'

/**
 * "איפה אני, ובאיזו דירה" — on Home, where the question is actually asked.
 *
 * Two facts, one strip, and both conditional on there being something to say
 * (owner, 29.09):
 *
 *  · Which apartment this is, and a way to change it — only for someone who belongs to
 *    more than one. A switcher with a single option teaches you the app is more
 *    complicated than it is.
 *  · Viewer access — "פשוט וברור אבל לא גדול". A banner would be shouting at someone
 *    about a limit they already agreed to; a small pill beside the address is enough to
 *    explain why the add buttons are not there.
 *
 * Someone with one apartment and full access sees nothing at all, which is almost
 * everybody, almost always.
 *
 * The list opens as a small menu under the chip (owner, 29.09 — this first shipped as a
 * dialog, on my reasoning that a menu near the top of a phone screen would cover the
 * greeting or escape the viewport; it does neither, because the chip is at the top and the
 * menu opens downward into empty space). It holds only the OTHER apartments: the active
 * one is already written on the chip, so repeating it there just adds a row that does
 * nothing when tapped.
 */
export function ApartmentBar() {
  const { households, ownerId, canWrite, switchHousehold } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // A menu that survives a tap elsewhere is a menu you have to fight. Pointerdown rather
  // than click, so it closes on the press that starts an interaction somewhere else.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const many = households.length > 1
  if (!many && canWrite) return null

  const current = households.find(h => h.id === ownerId)
  const label = current?.address || current?.name || 'הדירה שלי'
  const others = households.filter(h => h.id !== ownerId)

  return (
    <div className="hs-ctx">
      {many && (
        <div className="hs-ctx-wrap" ref={wrapRef}>
          <button type="button" className={`hs-ctx-chip${open ? ' is-open' : ''}`}
            onClick={() => setOpen(v => !v)}
            aria-haspopup="menu" aria-expanded={open}
            aria-label={`הדירה הפעילה: ${label}. מעבר לדירה אחרת`}>
            <House size={14} weight="fill" />
            <span className="hs-ctx-name">{label}</span>
            <CaretDown size={12} weight="bold" className="hs-ctx-caret" />
          </button>

          {open && (
            <div className="hs-ctx-menu" role="menu">
              {others.map(h => (
                <button key={h.id} type="button" role="menuitem" className="hs-ctx-item"
                  onClick={() => { setOpen(false); switchHousehold(h.id) }}>
                  <House size={15} weight="duotone" />
                  <span className="hs-ctx-item-name">{h.address || h.name}</span>
                  {h.role === 'viewer' && <Eye size={13} weight="bold" className="hs-ctx-item-eye" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!canWrite && (
        <span className="hs-ctx-view" title="יש לך גישת צפייה בלבד בדירה הזו">
          <Eye size={13} weight="bold" /> צפייה בלבד
        </span>
      )}
    </div>
  )
}
