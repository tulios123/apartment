import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail fast with a readable message instead of a cryptic runtime crash deep in the
// client if the build was shipped without its env (EDGE-26).
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (and in the Cloudflare Pages build env).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
