import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { myIncomingInvites, acceptInvite, type IncomingInvite } from '../lib/household'
import { InviteOffer } from './InviteOffer'
import { Modal } from './ui/Modal'

/**
 * Where a waiting invitation is actually met.
 *
 * Two shapes, because the two situations are genuinely different:
 *
 *  · `mode="blocking"` — the person has no apartment of their own. Shown INSTEAD of the
 *    onboarding wizard, because sending them into a nine-step setup for an apartment
 *    they were invited to already is both wrong and inescapable: the wizard has no way
 *    out to Settings, which is where the invitation used to live. This is the bug the
 *    owner hit with Omer on 29.09.
 *
 *  · `mode="entry"` — the person already has an apartment. A modal on entry, once per
 *    session: waiting in Settings for them to go looking is how the first one was missed.
 *
 * Declining is remembered per session, not per account: an invitation is not spam, and
 * refusing it permanently is a decision that belongs to the person who sent it.
 */
const dismissedKey = (uid: string) => `invite_dismissed:${uid}`

export function InviteGate({ mode, children }: {
  mode: 'blocking' | 'entry'
  children?: React.ReactNode
}) {
  const { user, refreshHouseholds, switchHousehold } = useAuth()
  const [invites, setInvites] = useState<IncomingInvite[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) { setInvites([]); return }
    try { setInvites(await myIncomingInvites()) } catch { setInvites([]) }
  }, [user])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!user) return
    try { setDismissed(sessionStorage.getItem(dismissedKey(user.id)) === '1') } catch { /* private mode */ }
  }, [user])

  const invite = invites?.[0]

  function decline() {
    setDismissed(true)
    if (user) { try { sessionStorage.setItem(dismissedKey(user.id), '1') } catch { /* ignore */ } }
  }

  async function accept() {
    if (!invite) return
    setBusy(true); setErr(null)
    const res = await acceptInvite(invite.id)
    setBusy(false)
    if (!res.ok) { setErr(res.message); return }
    await refreshHouseholds()
    switchHousehold(res.householdId)
    // The whole app re-reads from the new apartment; a reload is the honest way to get
    // every cached hook onto it at once rather than a half-switched screen.
    window.location.assign('/')
  }

  // `null` means "not asked yet". In blocking mode that distinction matters: rendering
  // the wizard for a moment and then replacing it would be its own small betrayal.
  if (mode === 'blocking' && invites === null) return null

  if (!invite || dismissed) return <>{children}</>

  const offer = (
    <>
      <InviteOffer
        invite={invite}
        busy={busy}
        onAccept={accept}
        onDecline={decline}
        declineLabel={mode === 'blocking' ? 'לא, אני רוצה להקים דירה משלי' : 'לא עכשיו'}
      />
      {err && <p className="onboarding-error" role="alert">{err}</p>}
    </>
  )

  if (mode === 'blocking') {
    return <div className="onboarding-wrap invofr-page">{offer}</div>
  }

  return (
    <>
      {children}
      <Modal onClose={decline} title="הוזמנת לדירה">
        {offer}
      </Modal>
    </>
  )
}
