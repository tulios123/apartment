import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const OLD_OWNER_ID = '00000000-0000-0000-0000-000000000001'
const MIGRATED_KEY = 'data_migrated_v1'

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
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

async function migrateOldData(userId: string, userName: string) {
  // Ensure an owners row exists for this user (required by FK constraints)
  await supabase.from('owners').upsert({ id: userId, name: userName }, { onConflict: 'id' })

  if (localStorage.getItem(MIGRATED_KEY) === userId) return
  const tables = ['transactions', 'tasks', 'recurring_items', 'documents', 'properties', 'contracts']
  for (const table of tables) {
    await (supabase.from(table as 'tasks') as ReturnType<typeof supabase.from>)
      .update({ owner_id: userId })
      .eq('owner_id', OLD_OWNER_ID)
  }
  localStorage.setItem(MIGRATED_KEY, userId)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      if (DEV_BYPASS) {
        const { data } = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD })
        if (data.session?.user) {
          await migrateOldData(data.session.user.id, 'Dev User')
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
          migrateOldData(session.user.id, name)
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
        await migrateOldData(session.user.id, name)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/tasks',
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  async function signOut() {
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
