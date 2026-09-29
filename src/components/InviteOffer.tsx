import { House, Eye, Users } from '@phosphor-icons/react'
import type { IncomingInvite } from '../lib/household'

/**
 * "הוזמנת לדירה" — one card, two places.
 *
 * It exists because of what happened the first time someone was really invited (owner,
 * 29.09: "עומר אומר שהוא לא רואה את זה"). It was not a caching problem and not his
 * mistake: a person with no apartment of their own is routed straight into the nine-step
 * wizard, and from inside the wizard there is no way to reach Settings — which is the
 * only place the invitation was shown. He was being asked to build an apartment while
 * the one he had been invited to sat behind a door he could not open.
 *
 * So the invitation is now met wherever the person actually is: instead of the wizard
 * when they have nothing yet, and on entry when they already have an apartment. Same
 * card in both, so the second time it is recognised rather than read again.
 *
 * What it says comes from the invitation itself (migration 053), not from a lookup: the
 * invitee cannot read an apartment they have not joined, and widening that policy to
 * fill in a line of text would trade a real boundary for a nicety.
 */
export function InviteOffer({ invite, busy, onAccept, onDecline, declineLabel }: {
  invite: IncomingInvite
  busy: boolean
  onAccept: () => void
  onDecline: () => void
  /** What "not now" means here — skipping it, or setting up your own apartment instead. */
  declineLabel: string
}) {
  const who = invite.invitedBy?.trim()
  const where = invite.householdLabel?.trim()

  return (
    <div className="invofr">
      <div className="invofr-badge"><House size={30} weight="duotone" /></div>

      <h2 className="invofr-title">
        {who ? `${who} שיתף/ה איתך דירה` : 'הוזמנת לדירה'}
      </h2>
      {where && <p className="invofr-where">{where}</p>}

      <div className={`invofr-role ${invite.role}`}>
        {invite.role === 'viewer'
          ? <><Eye size={15} weight="bold" /> <span><b>צופה בלבד</b> — תראו הכול, בלי לשנות.</span></>
          : <><Users size={15} weight="bold" /> <span><b>שותף/ה מלא/ה</b> — תראו ותשנו הכול, כמו כולם.</span></>}
      </div>

      <button className="btn-onboard-primary invofr-cta" onClick={onAccept} disabled={busy}>
        {busy ? 'מצטרפים…' : 'הצטרפות לדירה'}
      </button>
      <button className="btn-onboard-skip invofr-skip" onClick={onDecline} disabled={busy}>
        {declineLabel}
      </button>
    </div>
  )
}
