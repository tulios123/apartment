import { House, Check } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Which apartment am I looking at?
 *
 * Shown only to someone who belongs to more than one — for everybody else there is no
 * question to answer, and a control with a single option is a control that teaches you
 * the app is more complicated than it is.
 *
 * The choice persists per account, and switching empties the caches (see AuthContext), so
 * the second apartment cannot open showing the first one's numbers.
 */
export function ApartmentSwitcher() {
  const { households, ownerId, switchHousehold } = useAuth()
  if (households.length < 2) return null

  return (
    <section className="settings-section">
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
              onClick={() => { if (!active) switchHousehold(h.id) }}
            >
              <House size={18} weight={active ? 'fill' : 'duotone'} />
              <span className="hh-switch-name">{h.address || h.name}</span>
              {active && <Check size={16} weight="bold" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}
