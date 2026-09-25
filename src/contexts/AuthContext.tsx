import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { GOOGLE_TASKS_ENABLED } from '../lib/googleTasks'
import { clearQueryCache } from '../lib/queryCache'
import { clearOnboardingDraft } from '../lib/onboardingDraft'
import { redeemPreviewAuth } from '../lib/previewAuth'
import { disablePush } from '../lib/push'

// Dev-only auto-login. Gated on import.meta.env.DEV so it is compiled out of ANY
// production build (vite build ⇒ DEV=false) — even if the env var were misconfigured
// on the host, a prod bundle can never auto-login to the dev account.
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
const DEV_EMAIL = import.meta.env.VITE_DEV_USER_EMAIL as string
const DEV_PASSWORD = import.meta.env.VITE_DEV_USER_PASSWORD as string

/** An apartment you belong to. `id` is what every household-scoped row carries as owner_id. */
export interface Household {
  id: string
  name: string
  /** The property's address, when it has one — what the switcher shows. */
  address: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  /**
   * WHICH APARTMENT is being read and written — the single answer to a question that used
   * to be assumed. Every household-scoped table filters and stamps on this, never on
   * user.id, because since migration 051 a person can belong to more than one apartment
   * and an apartment to more than one person.
   *
   * It falls back to `user.id` while memberships are still loading, and that is deliberate
   * rather than lazy: for anyone in exactly one household — everyone, until someone is
   * invited — the two are the same value, so there is no window in which the app reads
   * nothing and blinks empty.
   *
   * Two tables deliberately do NOT use it: push_subscriptions and feedback. A device
   * belongs to a person and a report to its writer, not to an apartment.
   */
  ownerId: string | null
  households: Household[]
  switchHousehold: (id: string) => void
  refreshHouseholds: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

/** Which apartment was last chosen, per user. */
const ACTIVE_KEY = (uid: string) => `active_household:${uid}`

const AuthContext = createContext<AuthContextType>(null!)

async function ensureOwnerRow(userId: string, userName: string) {
  // Every user gets their own owners row (required by FK constraints). Each user's
  // data is isolated by owner_id = auth.uid() RLS — no cross-user migration.
  await supabase.from('owners').upsert({ id: userId, name: userName }, { onConflict: 'id' })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [households, setHouseholds] = useState<Household[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      if (DEV_BYPASS) {
        const { data } = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD })
        if (data.session?.user) {
          await ensureOwnerRow(data.session.user.id, 'Dev User')
        }
        setSession(data.session)
        setLoading(false)
        return
      }

      // Fix-preview handoff: if we arrived with a #fbauth token (the owner tapped "בדוק את
      // התיקון"), redeem it into a session BEFORE reading getSession, so the preview opens
      // already logged in as the owner instead of the login screen. No-op without a token.
      await redeemPreviewAuth()

      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setLoading(false)
      if (session?.user) {
        const name = session.user.user_metadata?.full_name ?? session.user.email ?? 'User'
        ensureOwnerRow(session.user.id, name)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (DEV_BYPASS) return
      setSession(session)
      // Only persist the Google OAuth provider token when Google Tasks sync is actually
      // enabled — otherwise it's an unused OAuth token sitting in localStorage (privacy).
      if (GOOGLE_TASKS_ENABLED && session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token)
      }
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('google_provider_token')
      }
      if (event === 'SIGNED_IN' && session?.user) {
        const name = session.user.user_metadata?.full_name ?? session.user.email ?? 'User'
        await ensureOwnerRow(session.user.id, name)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * The apartments this account belongs to.
   *
   * Two round-trips rather than a join, because household_members is readable only through
   * its own policy and `owners` through another; asking for each separately keeps both
   * within what RLS will answer, and the lists are at most three rows long.
   */
  const refreshHouseholds = useCallback(async () => {
    const uid = session?.user?.id
    if (!uid) { setHouseholds([]); setActiveId(null); return }
    const { data: memberRows, error } = await supabase
      .from('household_members').select('household_id').eq('user_id', uid)
    // Before migration 051 is applied the table does not exist. Falling back to the single
    // own-household case keeps every screen working exactly as it did.
    // Deduplicated: two people in the SAME apartment produce two membership rows, and if
    // the user_id filter is ever dropped — as the offline harness drops it — that lands
    // here as the same apartment listed twice, with duplicate React keys behind it.
    const ids = error ? [uid] : [...new Set((memberRows ?? []).map(r => r.household_id as string))]
    if (ids.length === 0) ids.push(uid)

    const [{ data: ownerRows }, { data: propRows }] = await Promise.all([
      supabase.from('owners').select('id, name').in('id', ids),
      supabase.from('properties').select('owner_id, address').in('owner_id', ids),
    ])
    const addressOf = new Map((propRows ?? []).map(p => [p.owner_id as string, p.address as string | null]))
    const list: Household[] = ids.map(id => ({
      id,
      name: (ownerRows ?? []).find(o => o.id === id)?.name ?? 'הדירה שלי',
      address: addressOf.get(id) ?? null,
    }))
    setHouseholds(list)

    // Keep the previous choice when it is still one of mine; otherwise prefer my own.
    let stored: string | null = null
    try { stored = localStorage.getItem(ACTIVE_KEY(uid)) } catch { /* private mode */ }
    const next = stored && ids.includes(stored) ? stored : (ids.includes(uid) ? uid : ids[0])
    setActiveId(next)
  }, [session?.user?.id])

  useEffect(() => { void refreshHouseholds() }, [refreshHouseholds])

  function switchHousehold(id: string) {
    setActiveId(id)
    const uid = session?.user?.id
    if (uid) { try { localStorage.setItem(ACTIVE_KEY(uid), id) } catch { /* private mode */ } }
    // The caches are keyed per user, not per apartment, so switching must empty them or
    // the new apartment would open showing the old one's numbers.
    clearQueryCache()
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // The Google Tasks `tasks` scope is sensitive (needs Google verification
        // to use beyond test users). While Tasks sync is suspended, request only
        // basic profile/email so any family member can sign in without friction.
        ...(GOOGLE_TASKS_ENABLED
          ? {
              scopes: 'https://www.googleapis.com/auth/tasks',
              queryParams: { access_type: 'offline', prompt: 'consent' },
            }
          : {}),
      },
    })
    // On success the browser redirects to Google (page unloads); an error means it
    // never left — surface it so the caller can show a message instead of silently
    // re-enabling the button.
    if (error) throw error
  }

  async function signOut() {
    // Clear this user's in-progress onboarding draft so it doesn't linger in
    // localStorage on a shared device after logout (privacy — audit). Do it before
    // signOut, while we still hold the user id the draft is keyed by.
    clearOnboardingDraft(session?.user?.id)
    clearQueryCache()
    // R15 (shared device): release this device's push subscription while we're still
    // authenticated (RLS requires it to delete the row). Otherwise the previous
    // account's reminders keep landing on whoever holds the device next. Best-effort —
    // a push hiccup must never block signing out. No opt-out flag: the same account's
    // next sign-in re-subscribes automatically.
    try { await disablePush() } catch { /* best-effort */ }
    await supabase.auth.signOut()
  }

  const user = session?.user ?? null
  // See the note on `ownerId` above: user.id is the fallback, not a guess.
  const ownerId = activeId ?? user?.id ?? null

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      ownerId, households, switchHousehold, refreshHouseholds,
      signInWithGoogle, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Co-locating the hook with its provider is standard; Fast Refresh still works here.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
