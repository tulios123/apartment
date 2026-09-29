import { useCallback, useEffect, useState } from 'react'
import { UserPlus, X, Check, SignOut, House, Eye } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import {
  MAX_MEMBERS, listMembers, listPendingInvites, invite, cancelInvite,
  myIncomingInvites, acceptInvite, leaveHousehold,
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
  const { user, ownerId, households, canWrite, switchHousehold, refreshHouseholds } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [incoming, setIncoming] = useState<IncomingInvite[]>([])
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const load = useCallback(async () => {
    if (!ownerId || !user) return
    const [m, p, i] = await Promise.all([
      listMembers(ownerId, user.id),
      listPendingInvites(ownerId),
      myIncomingInvites(),
    ])
    setMembers(m); setPending(p)
    // An invitation to an apartment you are already in is not news.
    setIncoming(i.filter(x => !households.some(h => h.id === x.householdId)))
  }, [ownerId, user, households])

  useEffect(() => { void load() }, [load])

  const taken = members.length + pending.length
  const slotsLeft = Math.max(0, MAX_MEMBERS - taken)
  const shared = members.length > 1 || pending.length > 0
  const myRole = households.find(h => h.id === ownerId)?.role ?? 'member'

  async function send() {
    if (!ownerId || busy) return
    setBusy(true); setMsg(null)
    const res = await invite(ownerId, email, user?.email ?? null, taken, role)
    setBusy(false)
    if (res.ok) {
      setEmail(''); setOpen(false)
      setMsg({ text: 'ההזמנה נשמרה. היא תחכה לה בכניסה הבאה לאפליקציה.', tone: 'ok' })
      void load()
    } else {
      setMsg({ text: res.message, tone: 'err' })
    }
  }

  async function accept(inv: IncomingInvite) {
    setBusy(true); setMsg(null)
    const res = await acceptInvite(inv.id)
    setBusy(false)
    if (!res.ok) { setMsg({ text: res.message, tone: 'err' }); return }
    await refreshHouseholds()
    switchHousehold(res.householdId)
    setMsg({ text: 'הצטרפת לדירה.', tone: 'ok' })
    void load()
  }

  async function leave() {
    if (!ownerId || !user) return
    setBusy(true)
    const ok = await leaveHousehold(ownerId, user.id)
    setBusy(false); setConfirmLeave(false)
    if (!ok) { setMsg({ text: 'היציאה נכשלה — נסו שוב', tone: 'err' }); return }
    await refreshHouseholds()
  }

  return (
    <section className="settings-section">
      <h2>שיתוף הדירה</h2>

      {/* An invitation waiting for me — first, because it is the only thing in this
          section about a different apartment than the one on screen. */}
      {incoming.map(inv => (
        <div className="hh-invite-in" key={inv.id}>
          <House size={18} weight="duotone" />
          <div className="hh-invite-in-body">
            <b>הוזמנת ל{inv.address ? `דירה ב${inv.address}` : inv.householdName}</b>
            <span>{inv.role === 'viewer' ? 'לצפייה בלבד.' : 'כשותף מלא.'} אחרי ההצטרפות אפשר לעבור בין הדירות מכאן.</span>
          </div>
          <button className="btn-secondary" disabled={busy} onClick={() => accept(inv)}>
            <Check size={14} weight="bold" /> הצטרפות
          </button>
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
              <button className="hh-member-x" aria-label={`ביטול ההזמנה ל${p.email}`}
                onClick={async () => { await cancelInvite(p.id); void load() }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="settings-note">הדירה הזו רק שלך.</p>
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
        <button type="button" className="btn-secondary hh-open" onClick={() => { setOpen(true); setMsg(null) }}>
          <UserPlus size={15} weight="bold" /> הזמנת מישהו
        </button>
      ) : (
        <div className="hh-invite">
          <label htmlFor="hh-email">המייל שאיתו היא נכנסת לאפליקציה</label>
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
            <button className="btn-secondary" disabled={busy || !email.trim()} onClick={send}>
              {busy ? 'שולח…' : 'שליחת הזמנה'}
            </button>
            <button className="btn-secondary hh-cancel" onClick={() => { setOpen(false); setEmail(''); setMsg(null) }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {msg && <p className={msg.tone === 'err' ? 'onboarding-error' : 'hh-ok'} role="status">{msg.text}</p>}

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
