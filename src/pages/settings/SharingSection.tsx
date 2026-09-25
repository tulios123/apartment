import { useCallback, useEffect, useState } from 'react'
import { UserPlus, X, Check, SignOut, House } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import {
  MAX_MEMBERS, listMembers, listPendingInvites, invite, cancelInvite,
  myIncomingInvites, acceptInvite, leaveHousehold,
  type Member, type PendingInvite, type IncomingInvite,
} from '../../lib/household'

/**
 * שיתוף הדירה — the feature Omer asked for by name: Moran on the same apartment, seeing
 * and doing the same things he does.
 *
 * Three states share one section, because they are one idea seen from different sides:
 * who is already on this apartment, who has been asked and has not answered, and — when
 * you are the one who was asked — the invitation waiting for you.
 *
 * Everything enforceable is enforced by the database (migration 051). This screen's job is
 * to say plainly what is about to happen, especially the two things people get wrong:
 * that a new member is an equal rather than a viewer, and that leaving does not take your
 * entries with you.
 */
export function SharingSection() {
  const { user, ownerId, households, switchHousehold, refreshHouseholds } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [incoming, setIncoming] = useState<IncomingInvite[]>([])
  const [email, setEmail] = useState('')
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
    // An invitation to the apartment you are already looking at is not news.
    setIncoming(i.filter(x => !households.some(h => h.id === x.householdId)))
  }, [ownerId, user, households])

  useEffect(() => { void load() }, [load])

  // A pending invitation is a place already spoken for.
  const taken = members.length + pending.length
  const slotsLeft = Math.max(0, MAX_MEMBERS - taken)
  const full = taken >= MAX_MEMBERS
  const iAmOnlyMember = members.length <= 1

  async function send() {
    if (!ownerId || busy) return
    setBusy(true); setMsg(null)
    const res = await invite(ownerId, email, user?.email ?? null, taken)
    setBusy(false)
    if (res.ok) {
      setEmail('')
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
    setBusy(false)
    setConfirmLeave(false)
    if (!ok) { setMsg({ text: 'היציאה נכשלה — נסו שוב', tone: 'err' }); return }
    await refreshHouseholds()
  }

  return (
    <section className="settings-section">
      <h2>שיתוף הדירה</h2>
      {/* How many MORE can join, not the fixed cap — a household with two members and an
          invitation out has one place left, and saying "עוד 2" there is simply wrong. */}
      <p className="settings-note">
        {slotsLeft > 0
          ? <>אפשר לשתף את הדירה עם עוד {slotsLeft === 1 ? 'אדם אחד' : `${slotsLeft} אנשים`}. </>
          : null}
        כל מי שמשותף רואה ועושה בדיוק את אותם דברים — אין "צופה בלבד".
      </p>

      {/* An invitation waiting for me. First, because it is the only thing here that is
          about a different apartment than the one on screen. */}
      {incoming.map(inv => (
        <div className="hh-invite-in" key={inv.id}>
          <House size={18} weight="duotone" />
          <div className="hh-invite-in-body">
            <b>הוזמנת ל{inv.address ? `דירה ב${inv.address}` : inv.householdName}</b>
            <span>אחרי ההצטרפות תוכלו לעבור בין הדירות מכאן.</span>
          </div>
          <button className="btn-secondary" disabled={busy} onClick={() => accept(inv)}>
            <Check size={14} weight="bold" /> הצטרפות
          </button>
        </div>
      ))}

      <div className="hh-members">
        {members.map(m => (
          <div className="hh-member" key={m.userId}>
            <span className="hh-member-name">{m.name}{m.isMe && <span className="hh-you"> · את/ה</span>}</span>
            {m.email && <span className="hh-member-email">{m.email}</span>}
          </div>
        ))}
        {pending.map(p => (
          <div className="hh-member pending" key={p.id}>
            <span className="hh-member-name">{p.email}</span>
            <span className="hh-member-email">ממתין/ה לאישור</span>
            <button className="hh-member-x" aria-label={`ביטול ההזמנה ל${p.email}`}
              onClick={async () => { await cancelInvite(p.id); void load() }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {full ? (
        <p className="settings-note">
          {members.length >= MAX_MEMBERS
            ? `הדירה כוללת כבר ${MAX_MEMBERS} אנשים — המקסימום כרגע.`
            : `כל המקומות תפוסים — ${members.length} משותפים ו-${pending.length} הזמנות שממתינות.`}
        </p>
      ) : (
        <div className="hh-invite">
          <label htmlFor="hh-email">הזמנה לפי מייל</label>
          <div className="hh-invite-row">
            <input id="hh-email" type="email" inputMode="email" dir="ltr"
              placeholder="name@gmail.com" value={email}
              onChange={e => { setEmail(e.target.value); setMsg(null) }} />
            <button className="btn-secondary" disabled={busy || !email.trim()} onClick={send}>
              <UserPlus size={15} weight="bold" /> הזמנה
            </button>
          </div>
          <span className="settings-note">
            צריך להיות המייל שאיתו היא נכנסת לאפליקציה — ההזמנה תחכה לה שם.
          </span>
        </div>
      )}

      {msg && <p className={msg.tone === 'err' ? 'onboarding-error' : 'hh-ok'} role="status">{msg.text}</p>}

      {/* Leaving is only offered where it means something. Leaving an apartment that is
          yours alone would just hide it from you with nobody left to let you back in. */}
      {!iAmOnlyMember && (
        <div className="settings-actions">
          {confirmLeave ? (
            <>
              <span className="settings-note">
                לצאת מהדירה? תאבדו גישה אליה. מה שהזנתם נשאר בדירה.
              </span>
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
    </section>
  )
}
