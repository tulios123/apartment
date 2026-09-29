import { supabase } from './supabase'

/**
 * שיתוף דירה — who else is on this apartment, and how someone joins.
 *
 * Everything here is a thin wrapper over migration 051. The rules that matter live in the
 * database, not in this file, and that is the point: the member cap is a trigger, and
 * joining is a SECURITY DEFINER function that checks the invitation is addressed to the
 * caller's own email. A client can be bypassed; a policy cannot.
 */

export const MAX_MEMBERS = 3

/** Chosen when inviting, carried by the invitation, and enforced by RLS (migration 052). */
export type Role = 'member' | 'viewer'

export interface Member {
  userId: string
  name: string
  email: string | null
  role: Role
  /** True for the account this app is currently signed in as. */
  isMe: boolean
}

export interface PendingInvite {
  id: string
  email: string
  role: Role
  createdAt: string
}

/** An invitation waiting for the signed-in account, on some other apartment. */
export interface IncomingInvite {
  id: string
  householdId: string
  /** Who invited you, and to what — carried ON the invitation (migration 053). */
  invitedBy: string | null
  householdLabel: string | null
  role: Role
}

/**
 * The table did not exist before 051. Rather than let every screen that touches sharing
 * explode on an un-migrated database, a missing table reads as "sharing is not available
 * here yet" — the same shape as an empty result.
 */
function missingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '')
}

export async function listMembers(householdId: string, myUserId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('household_members').select('user_id, role').eq('household_id', householdId)
  if (error) return missingTable(error) ? [] : []
  const ids = [...new Set((data ?? []).map(r => r.user_id as string))]
  // 'member' when the column is missing (a database still on 051), which is what every
  // existing membership is.
  const roleOf = new Map((data ?? []).map(r =>
    [r.user_id as string, ((r as { role?: string }).role === 'viewer' ? 'viewer' : 'member') as Role]))
  if (ids.length === 0) return []
  // Names live on `owners`; a member who has never created an apartment of their own has
  // no row there, so the id is the fallback rather than a crash.
  const { data: people } = await supabase.from('owners').select('id, name, email').in('id', ids)
  return ids.map(id => {
    const p = (people ?? []).find(o => o.id === id)
    return {
      userId: id,
      name: (p?.name as string) || 'בן משפחה',
      email: (p?.email as string) ?? null,
      role: roleOf.get(id) ?? 'member',
      isMe: id === myUserId,
    }
  })
}

export async function listPendingInvites(householdId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('household_invites').select('id, email, role, created_at')
    .eq('household_id', householdId).is('accepted_at', null)
    .order('created_at')
  if (error) return []
  return (data ?? []).map(r => ({
    id: r.id as string,
    email: r.email as string,
    role: ((r as { role?: string }).role === 'viewer' ? 'viewer' : 'member') as Role,
    createdAt: r.created_at as string,
  }))
}

export type InviteResult =
  | { ok: true }
  | { ok: false; reason: 'full' | 'already' | 'self' | 'invalid' | 'failed'; message: string }

/**
 * Send, or send again.
 *
 * Through a function rather than an insert, because a second invitation to the same
 * address collides with `unique (household_id, email)` — and the first version reported
 * that collision as an error, so someone who never received the first invitation could
 * not be sent another, and someone who had left could never be re-invited at all
 * (owner, 29.09). Re-sending updates the existing row: same invitation, newly offered.
 *
 * `householdLabel` and `invitedByLabel` travel with it because the person invited cannot
 * read the household they have not joined — which is correct and stays correct. Without
 * them the card says "הוזמנת לדירה" and nothing else.
 */
export async function invite(
  householdId: string,
  email: string,
  myEmail: string | null,
  role: Role = 'member',
  labels: { household?: string | null; invitedBy?: string | null } = {},
): Promise<InviteResult> {
  const addr = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
    return { ok: false, reason: 'invalid', message: 'כתובת המייל לא נראית תקינה' }
  }
  if (addr === (myEmail ?? '').toLowerCase()) {
    return { ok: false, reason: 'self', message: 'זו הכתובת שלך' }
  }
  const { error } = await supabase.rpc('upsert_invite', {
    p_household: householdId,
    p_email: addr,
    p_role: role,
    p_household_label: labels.household ?? null,
    p_invited_by_label: labels.invitedBy ?? null,
  })
  if (error) {
    const m = error.message ?? ''
    if (m.includes('household_full')) return { ok: false, reason: 'full', message: `דירה יכולה לכלול עד ${MAX_MEMBERS} אנשים` }
    if (m.includes('already_member')) return { ok: false, reason: 'already', message: 'האדם הזה כבר בדירה' }
    if (m.includes('bad_email')) return { ok: false, reason: 'invalid', message: 'כתובת המייל לא נראית תקינה' }
    if (m.includes('not_allowed')) return { ok: false, reason: 'failed', message: 'רק שותף מלא יכול להזמין' }
    return { ok: false, reason: 'failed', message: 'לא הצלחנו לשלוח את ההזמנה — נסו שוב' }
  }
  return { ok: true }
}

export async function cancelInvite(id: string): Promise<boolean> {
  const { error } = await supabase.from('household_invites').delete().eq('id', id)
  return !error
}

/** Invitations addressed to the signed-in account. RLS does the matching, not this query. */
/**
 * Invitations addressed to the signed-in account.
 *
 * `myEmail` is checked here as well as by the policy, and that is not belt-and-braces for
 * its own sake: this decides what a person is SHOWN about an apartment they have not
 * joined, and a visibility decision must not rest on the server filter alone. The same
 * reasoning caught a real bug in the role lookup — and the offline harness, which drops
 * such filters, turns the omission into an invitation from a stranger appearing on screen.
 */
export async function myIncomingInvites(myEmail?: string | null): Promise<IncomingInvite[]> {
  // Only the invitation's own columns. Looking the household up would return nothing —
  // the whole point is that the invitee cannot read an apartment they have not joined.
  const { data, error } = await supabase
    .from('household_invites')
    .select('id, household_id, role, email, household_label, invited_by_label')
    .is('accepted_at', null)
  if (error || !data || data.length === 0) return []
  const mine = myEmail
    ? data.filter(r => String((r as { email?: string }).email ?? '').toLowerCase() === myEmail.toLowerCase())
    : data
  return mine.map(r => ({
    id: r.id as string,
    householdId: r.household_id as string,
    invitedBy: ((r as { invited_by_label?: string }).invited_by_label) ?? null,
    householdLabel: ((r as { household_label?: string }).household_label) ?? null,
    role: ((r as { role?: string }).role === 'viewer' ? 'viewer' : 'member') as Role,
  }))
}

export type AcceptResult = { ok: true; householdId: string } | { ok: false; message: string }

/**
 * Accepting goes through the database function, never a direct insert — an insert policy
 * permissive enough to let someone add themselves to a household is the hole this feature
 * must not open. The messages below are the function's own error codes, translated.
 */
export async function acceptInvite(inviteId: string): Promise<AcceptResult> {
  const { data, error } = await supabase.rpc('accept_invite', { invite_id: inviteId })
  if (error) {
    const m = error.message ?? ''
    if (m.includes('household_full')) return { ok: false, message: `הדירה כבר כוללת ${MAX_MEMBERS} אנשים` }
    if (m.includes('invite_already_used')) return { ok: false, message: 'ההזמנה כבר נוצלה' }
    if (m.includes('invite_not_found')) return { ok: false, message: 'ההזמנה לא נמצאה' }
    return { ok: false, message: 'ההצטרפות נכשלה — נסו שוב' }
  }
  return { ok: true, householdId: data as string }
}

/** Leaving removes access; whatever you added stays with the apartment. */
export async function leaveHousehold(householdId: string, myUserId: string): Promise<boolean> {
  const { error } = await supabase.from('household_members').delete()
    .eq('household_id', householdId).eq('user_id', myUserId)
  return !error
}
