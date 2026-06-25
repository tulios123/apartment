import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { GOOGLE_TASKS_ENABLED } from '../lib/googleTasks'
import { clearQueryCache } from '../lib/queryCache'

// Dev-only auto-login. Gated on import.meta.env.DEV so it is compiled out of ANY
// production build (vite build ⇒ DEV=false) — even if the env var were misconfigured
// on the host, a prod bundle can never auto-login to the dev account.
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
const DEV_EMAIL = import.meta.env.VITE_DEV_USER_EMAIL as string
const DEV_PASSWORD = import.meta.env.VITE_DEV_USER_PASSWORD as string

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>(null!)

async function ensureOwnerRow(userId: string, userName: string) {
  // Every user gets their own owners row (required by FK constraints). Each user's
  // data is isolated by owner_id = auth.uid() RLS — no cross-user migration.
  await supabase.from('owners').upsert({ id: userId, name: userName }, { onConflict: 'id' })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

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

      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setLoading(false)
        if (session?.user) {
          const name = session.user.user_metadata?.full_name ?? session.user.email ?? 'User'
          ensureOwnerRow(session.user.id, name)
        }
      })
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (DEV_BYPASS) return
      setSession(session)
      if (session?.provider_token) {
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

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
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
  }

  async function signOut() {
    clearQueryCache()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// Co-locating the hook with its provider is standard; Fast Refresh still works here.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
