import { useState } from 'react'
import { House, CaretDown, Eye, Check } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { Modal } from '../../components/ui/Modal'

/**
 * "איפה אני, ובאיזו דירה" — on Home, where the question is actually asked.
 *
 * Two facts, one strip, and both of them are conditional on there being something to say
 * (owner, 29.09):
 *
 *  · Which apartment this is, and a way to change it — only for someone who belongs to
 *    more than one. A switcher with a single option teaches you the app is more
 *    complicated than it is, and it was already hidden on that rule in Settings.
 *  · Viewer access — "פשוט וברור אבל לא גדול". A banner would be shouting at someone
 *    about a limit they already agreed to; a small pill beside the address is enough to
 *    explain why the add buttons are not there.
 *
 * Someone with one apartment and full access sees nothing at all, which is almost
 * everybody, almost always.
 *
 * Switching opens the list in a dialog rather than a menu: on a phone a dropdown anchored
 * to a chip near the top of the screen either covers the greeting or escapes the viewport,
 * and the list is at most three rows.
 */
export function ApartmentBar() {
  const { households, ownerId, canWrite, switchHousehold } = useAuth()
  const [open, setOpen] = useState(false)

  const many = households.length > 1
  if (!many && canWrite) return null

  const current = households.find(h => h.id === ownerId)
  const label = current?.address || current?.name || 'הדירה שלי'

  return (
    <div className="hs-ctx">
      {many && (
        <button type="button" className="hs-ctx-chip" onClick={() => setOpen(true)}
          aria-haspopup="dialog" aria-label={`הדירה הפעילה: ${label}. מעבר לדירה אחרת`}>
          <House size={14} weight="fill" />
          <span className="hs-ctx-name">{label}</span>
          <CaretDown size={12} weight="bold" />
        </button>
      )}

      {!canWrite && (
        <span className="hs-ctx-view" title="יש לך גישת צפייה בלבד בדירה הזו">
          <Eye size={13} weight="bold" /> צפייה בלבד
        </span>
      )}

      {open && (
        <Modal title="מעבר בין דירות" onClose={() => setOpen(false)} variant="dialog">
          <div className="hs-switch-dlg">
            <h2>הדירה הפעילה</h2>
            <p className="settings-note">כל המסכים מראים את הדירה שנבחרה כאן.</p>
            <div className="hh-switch">
              {households.map(h => {
                const active = h.id === ownerId
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`hh-switch-row${active ? ' is-active' : ''}`}
                    aria-current={active || undefined}
                    onClick={() => { setOpen(false); if (!active) switchHousehold(h.id) }}
                  >
                    <House size={18} weight={active ? 'fill' : 'duotone'} />
                    <span className="hh-switch-name">{h.address || h.name}</span>
                    {h.role === 'viewer' && <span className="hh-switch-role"><Eye size={12} weight="bold" /></span>}
                    {active && <Check size={16} weight="bold" />}
                  </button>
                )
              })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
