import { useCallback, useEffect, useState } from 'react'
import { UserPlus, X, SignOut, Eye, ArrowClockwise } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import {
  MAX_MEMBERS, listMembers, listPendingInvites, invite, cancelInvite, leaveHousehold,
  myIncomingInvites, acceptInvite,
  type Member, type PendingInvite, type IncomingInvite, type Role,
} from '../../lib/household'

/**
 * שיתוף הדירה.
 *
 * Rebuilt 29.09 after the owner read the first version: "למה יש שם קופסה של המייל שלי
 * למעלה ויש שם יותר מדי מלל".
 *
 * Both complaints are the same mistake — the section was written for the shared case and
 * shown to everyone. Alone in your own apartment there is no list worth reading (it has
 * one row, and the row is you), and no paragraph worth reading either, because nothing
 * has happened yet. So: one line and one button. The form opens from the button, the
 * member list appears only once there is more than one member, and the explanation of
 * what each permission means sits on the permission control itself rather than above the
 * whole section in the abstract.
 */

const ROLE_LABEL: Record<Role, string> = { member: 'שותף מלא', viewer: 'צופה בלבד' }
const ROLE_HINT: Record<Role, string> = {
  member: 'רואה הכול, ויכול להוסיף, לערוך ולמחוק — בדיוק כמוך.',
  viewer: 'רואה הכול, ולא יכול לשנות שום דבר.',
}

export function SharingSection() {
  const { user, ownerId, households, canWrite, refreshHouseholds } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [incoming, setIncoming] = useState<IncomingInvite[]>([])
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  /** The pending invitation the form was opened from, so a corrected address replaces it. */
  const [editing, setEditing] = useState<PendingInvite | null>(null)

  /**
   * Invitations addressed to ME are shown here as well as at the door.
   *
   * They were moved out entirely when the door was built, and that was an
   * over-correction: the door can be missed — dismissed, or simply not there yet on a
   * phone still running an older build — and then there is no second place to look. A
   * thing that exists in exactly one place is a thing that can disappear.
   */
  const load = useCallback(async () => {
    if (!ownerId || !user) return
    const [m, p, i] = await Promise.all([
      listMembers(ownerId, user.id),
      listPendingInvites(ownerId),
      myIncomingInvites(user.email),
    ])
    setMembers(m); setPending(p)
    setIncoming(i.filter(x => !households.some(h => h.id === x.householdId)))
  }, [ownerId, user, households])

  useEffect(() => { void load() }, [load])

  const taken = members.length + pending.length
  const slotsLeft = Math.max(0, MAX_MEMBERS - taken)
  const shared = members.length > 1 || pending.length > 0
  const myRole = households.find(h => h.id === ownerId)?.role ?? 'member'

  // The labels travel with the invitation because the person invited cannot read the
  // apartment they have not joined — without them the card says "הוזמנת לדירה" and
  // nothing else. They come from here, where they ARE readable.
  const labels = {
    household: households.find(h => h.id === ownerId)?.address
      ?? households.find(h => h.id === ownerId)?.name ?? null,
    invitedBy: members.find(m => m.isMe)?.name
      ?? user?.user_metadata?.full_name as string | undefined
      ?? user?.email ?? null,
  }

  async function send(addr: string, r: Role) {
    if (!ownerId || busy) return
    setBusy(true); setMsg(null)
    const res = await invite(ownerId, addr, user?.email ?? null, r, labels)
    if (res.ok && editing && editing.email.toLowerCase() !== addr.trim().toLowerCase()) {
      // The address was corrected rather than re-sent: the old invitation would otherwise
      // sit there for ever, addressed to someone who is never going to see it.
      await cancelInvite(editing.id)
    }
    setBusy(false)
    if (res.ok) {
      const resent = !!editing && editing.email.toLowerCase() === addr.trim().toLowerCase()
      setEmail(''); setOpen(false); setEditing(null)
      setMsg({
        text: resent ? 'ההזמנה נשלחה שוב.' : 'ההזמנה נשמרה. היא תחכה לה בכניסה הבאה לאפליקציה.',
        tone: 'ok',
      })
      void load()
    } else {
      setMsg({ text: res.message, tone: 'err' })
    }
  }

  /** Open the form on an existing invitation — to send it again, or to fix the address. */
  function reopen(p: PendingInvite) {
    setEditing(p); setEmail(p.email); setRole(p.role); setOpen(true); setMsg(null)
  }

  async function leave() {
    if (!ownerId || !user) return
    setBusy(true)
    const ok = await leaveHousehold(ownerId, user.id)
    setBusy(false); setConfirmLeave(false)
    if (!ok) { setMsg({ text: 'היציאה נכשלה — נסו שוב', tone: 'err' }); return }
    await refreshHouseholds()
  }

  async function join(inv: IncomingInvite) {
    setBusy(true); setMsg(null)
    const res = await acceptInvite(inv.id)
    setBusy(false)
    if (!res.ok) { setMsg({ text: res.message, tone: 'err' }); return }
    await refreshHouseholds()
    window.location.assign('/')
  }

  return (
    <section className="settings-section">
      <h2>שיתוף הדירה</h2>

      {/* Also at the door (components/InviteGate) — deliberately in both places. */}
      {incoming.map(inv => (
        <div className="hh-invite-in" key={inv.id}>
          <div className="hh-invite-in-body">
            <b>{inv.invitedBy ? `${inv.invitedBy} שיתף/ה איתך דירה` : 'הוזמנת לדירה'}</b>
            <span>{inv.householdLabel ?? ''}{inv.role === 'viewer' ? ' · כצופה בלבד' : ''}</span>
          </div>
          <button className="btn-secondary" disabled={busy} onClick={() => join(inv)}>הצטרפות</button>
        </div>
      ))}

      {/* The list earns its place only once someone else is on the apartment. On your
          own it is one row saying your own address back to you. */}
      {shared ? (
        <div className="hh-members">
          {members.map(m => (
            <div className="hh-member" key={m.userId}>
              <span className="hh-member-name">{m.name}{m.isMe && <span className="hh-you"> · את/ה</span>}</span>
              {m.email && <span className="hh-member-email">{m.email}</span>}
              {m.role === 'viewer' && <span className="hh-role"><Eye size={12} weight="bold" /> צופה</span>}
            </div>
          ))}
          {pending.map(p => (
            <div className="hh-member pending" key={p.id}>
              <span className="hh-member-name">{p.email}</span>
              <span className="hh-member-email">ממתין/ה{p.role === 'viewer' ? ' · כצופה' : ''}</span>
              {/* Sending again used to be refused outright by the unique constraint —
                  so someone who never got the first invitation could not be sent
                  another (owner, 29.09). */}
              {canWrite && (
                <span className="hh-member-acts">
                  <button className="hh-member-x" title="שליחה שוב או תיקון הכתובת"
                    aria-label={`שליחה שוב או תיקון הכתובת של ההזמנה ל${p.email}`}
                    disabled={busy} onClick={() => reopen(p)}>
                    <ArrowClockwise size={14} />
                  </button>
                  <button className="hh-member-x" aria-label={`ביטול ההזמנה ל${p.email}`}
                    onClick={async () => { await cancelInvite(p.id); void load() }}>
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="settings-note">הדירה הזו רק שלך.</p>
      )}

      {/* The one thing the sender could never see.
          An invitation sat on "ממתין/ה" forever with nothing to say whether it could
          possibly arrive — and the likeliest reason it cannot is that the address is not
          the one she signs in with. Stating it is what turns a mystery into a fix.
          The reader's own address is beside it, because comparing the two is the check. */}
      {pending.length > 0 && (
        <p className="settings-note hh-check">
          הזמנה מגיעה רק לכתובת שאיתה נכנסים לאפליקציה. אם היא נכנסת עם מייל אחר — הקישו
          על ↻ ושלחו לכתובת הנכונה. <span dir="ltr">({user?.email ?? '—'} :אתה)</span>
        </p>
      )}

      {/* A viewer cannot invite — RLS refuses it, and a viewer who could invite a full
          member would be promoting themselves by proxy. */}
      {!canWrite ? (
        <p className="settings-note">
          <Eye size={13} weight="bold" /> יש לך גישת צפייה בלבד בדירה הזו.
        </p>
      ) : slotsLeft === 0 ? (
        <p className="settings-note">
          כל המקומות תפוסים — עד {MAX_MEMBERS} אנשים לדירה.
        </p>
      ) : !open ? (
        <>
          {/* Directly under the button that produced it. It used to sit after the whole
              invite block, and on success that block collapses — so the confirmation
              appeared half-clipped against the following section (owner, 29.09). */}
          {msg && <p className={`hh-msg ${msg.tone === 'err' ? 'onboarding-error' : 'hh-ok'}`} role="status">{msg.text}</p>}
          <button type="button" className="btn-secondary hh-open" onClick={() => { setEditing(null); setEmail(''); setOpen(true); setMsg(null) }}>
            <UserPlus size={15} weight="bold" /> הזמנת מישהו
          </button>
        </>
      ) : (
        <div className="hh-invite">
          <label htmlFor="hh-email">
            {editing ? 'הכתובת שאליה נשלחת ההזמנה' : 'המייל שאיתו היא נכנסת לאפליקציה'}
          </label>
          <input id="hh-email" type="email" inputMode="email" dir="ltr" autoFocus
            placeholder="name@gmail.com" value={email}
            onChange={e => { setEmail(e.target.value); setMsg(null) }} />

          <div className="toggle-group hh-roles">
            {(['member', 'viewer'] as Role[]).map(r => (
              <button key={r} type="button" className={`toggle-btn${role === r ? ' active' : ''}`}
                onClick={() => setRole(r)}>{ROLE_LABEL[r]}</button>
            ))}
          </div>
          {/* The explanation belongs to the choice, not to the section — it changes with
              what is selected, which is the only moment it means anything. */}
          <span className="settings-note hh-role-hint">{ROLE_HINT[role]}</span>

          <div className="hh-invite-actions">
            <button className="btn-secondary" disabled={busy || !email.trim()} onClick={() => send(email, role)}>
              {busy ? 'שולח…' : editing ? 'שליחה' : 'שליחת הזמנה'}
            </button>
            <button className="btn-secondary hh-cancel" onClick={() => { setOpen(false); setEmail(''); setEditing(null); setMsg(null) }}>
              ביטול
            </button>
          </div>
          {msg && <p className={`hh-msg ${msg.tone === 'err' ? 'onboarding-error' : 'hh-ok'}`} role="status">{msg.text}</p>}
        </div>
      )}

      {/* Leaving is offered only where it means something: leaving an apartment that is
          yours alone would hide it from you with nobody left to let you back in. */}
      {members.length > 1 && (
        <div className="settings-actions">
          {confirmLeave ? (
            <>
              <span className="settings-note">לצאת מהדירה? תאבדו גישה אליה. מה שהזנתם נשאר בדירה.</span>
              <button className="btn-secondary" disabled={busy} onClick={leave}>כן, לצאת</button>
              <button className="btn-secondary" onClick={() => setConfirmLeave(false)}>ביטול</button>
            </>
          ) : (
            <button className="btn-secondary" onClick={() => setConfirmLeave(true)}>
              <SignOut size={14} /> יציאה מהדירה המשותפת
            </button>
          )}
        </div>
      )}

      {myRole === 'viewer' && shared && (
        <p className="settings-note">מי ששיתף אותך יכול להפוך אותך לשותף/ה מלא/ה.</p>
      )}
    </section>
  )
}
