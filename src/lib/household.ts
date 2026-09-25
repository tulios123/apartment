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

export interface Member {
  userId: string
  name: string
  email: string | null
  /** True for the account this app is currently signed in as. */
  isMe: boolean
}

export interface PendingInvite {
  id: string
  email: string
  createdAt: string
}

/** An invitation waiting for the signed-in account, on some other apartment. */
export interface IncomingInvite {
  id: string
  householdId: string
  householdName: string
  address: string | null
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
    .from('household_members').select('user_id').eq('household_id', householdId)
  if (error) return missingTable(error) ? [] : []
  const ids = [...new Set((data ?? []).map(r => r.user_id as string))]
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
      isMe: id === myUserId,
    }
  })
}

export async function listPendingInvites(householdId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('household_invites').select('id, email, created_at')
    .eq('household_id', householdId).is('accepted_at', null)
    .order('created_at')
  if (error) return []
  return (data ?? []).map(r => ({ id: r.id as string, email: r.email as string, createdAt: r.created_at as string }))
}

export type InviteResult =
  | { ok: true }
  | { ok: false; reason: 'full' | 'already' | 'self' | 'invalid' | 'failed'; message: string }

export async function invite(householdId: string, email: string, myEmail: string | null, memberCount: number): Promise<InviteResult> {
  const addr = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
    return { ok: false, reason: 'invalid', message: 'כתובת המייל לא נראית תקינה' }
  }
  if (addr === (myEmail ?? '').toLowerCase()) {
    return { ok: false, reason: 'self', message: 'זו הכתובת שלך' }
  }
  // Checked here for a decent message, and enforced again by the trigger on the way in.
  if (memberCount >= MAX_MEMBERS) {
    return { ok: false, reason: 'full', message: `דירה יכולה לכלול עד ${MAX_MEMBERS} אנשים` }
  }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('household_invites')
    .insert({ household_id: householdId, email: addr, invited_by: user?.id })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, reason: 'already', message: 'כבר נשלחה הזמנה לכתובת הזו' }
    }
    return { ok: false, reason: 'failed', message: 'לא הצלחנו לשלוח את ההזמנה — נסו שוב' }
  }
  return { ok: true }
}

export async function cancelInvite(id: string): Promise<boolean> {
  const { error } = await supabase.from('household_invites').delete().eq('id', id)
  return !error
}

/** Invitations addressed to the signed-in account. RLS does the matching, not this query. */
export async function myIncomingInvites(): Promise<IncomingInvite[]> {
  const { data, error } = await supabase
    .from('household_invites').select('id, household_id').is('accepted_at', null)
  if (error || !data || data.length === 0) return []
  const ids = data.map(r => r.household_id as string)
  const [{ data: owners }, { data: props }] = await Promise.all([
    supabase.from('owners').select('id, name').in('id', ids),
    supabase.from('properties').select('owner_id, address').in('owner_id', ids),
  ])
  return data.map(r => {
    const hid = r.household_id as string
    return {
      id: r.id as string,
      householdId: hid,
      householdName: (owners ?? []).find(o => o.id === hid)?.name as string ?? 'דירה',
      address: ((props ?? []).find(p => p.owner_id === hid)?.address as string) ?? null,
    }
  })
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
