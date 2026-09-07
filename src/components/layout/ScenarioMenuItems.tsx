import { useState } from 'react'
import { FlagPennant } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { isFeedbackAdmin, isManager, FEEDBACK_ADMIN_EMAIL } from '../../lib/admin'
import { isStaging } from '../../lib/env'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/format'
import { userErrorMessage } from '../../lib/errorHe'
import { SCENARIOS, applyScenario, type ScenarioId } from '../../lib/scenarios'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/**
 * Staging-only stage switcher, living in the account menu because that is one tap from
 * anywhere (owner: "I shouldn't have to go through Settings").
 *
 * Loads a coherent account rather than forcing a screen into a state, so what appears is
 * derived exactly as it will be for a real user — see src/lib/scenarios.ts.
 *
 * Renders nothing at all in production, which is also what keeps this work separable: a
 * promotion for something unrelated cannot carry it into the family's app.
 */
export function ScenarioMenuItems() {
  const { user } = useAuth()
  const [pending, setPending] = useState<ScenarioId | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visible = (isStaging || import.meta.env.DEV) && (isFeedbackAdmin(user?.email) || isManager(user?.email))
  // Both environments talk to one database, so the testing app signed in as the owner is
  // looking at the family's live data. A wipe must be unreachable from there — not merely
  // confirmed.
  const ownerIdentity = user?.email?.toLowerCase() === FEEDBACK_ADMIN_EMAIL.toLowerCase()
  if (!visible || ownerIdentity) return null

  async function run(id: ScenarioId) {
    if (!user) return
    setBusy(true)
    try {
      await applyScenario(supabase, user.id, id, todayISO())
      window.location.assign('/')
    } catch (e) {
      setError(userErrorMessage(e, 'טעינת התרחיש נכשלה — נסו שוב'))
      setBusy(false)
      setPending(null)
    }
  }

  const pendingLabel = SCENARIOS.find(s => s.id === pending)?.label ?? ''

  return (
    <>
      <div className="usermenu-sep" />
      <div className="usermenu-grouplabel">תרחישי בדיקה</div>
      {SCENARIOS.map(s => (
        <button
          key={s.id}
          className="usermenu-item"
          role="menuitem"
          onClick={() => { setError(null); setPending(s.id) }}
        >
          <FlagPennant size={20} />
          <span>{s.label}</span>
        </button>
      ))}
      {error && <div className="usermenu-grouplabel" role="alert">{error}</div>}

      <ConfirmDialog
        open={pending != null}
        tone="danger"
        title={`לטעון תרחיש "${pendingLabel}"?`}
        // Name the account being erased: with one database behind both environments,
        // "which account am I in" is the entire question.
        message={`כל הנתונים ב-${user?.email} יימחקו ויוחלפו בנתוני הדוגמה של התרחיש.`}
        confirmLabel={busy ? 'טוען…' : 'מחק וטען'}
        onConfirm={() => { if (!busy && pending) run(pending) }}
        onCancel={() => { if (!busy) setPending(null) }}
      />
    </>
  )
}
