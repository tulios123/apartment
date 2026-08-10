// Shared plumbing for the audit seed/cleanup scripts.
// Auth model (PROMPT_REVIEW §4): sign in as the dev test account over the ANON key —
// RLS confines every write/delete to that account by construction. No service-role key.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

export function loadEnvLocal() {
  const file = path.resolve('.env.local')
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

export function requireFlags(argv) {
  const ownerIdx = argv.indexOf('--owner-email')
  const ownerEmail = ownerIdx >= 0 ? argv[ownerIdx + 1] : null
  const ack = argv.includes('--i-know-this-is-shared-supabase')
  if (!ownerEmail || !ack) {
    console.error('Refusing to run. Required: --owner-email <email> --i-know-this-is-shared-supabase')
    process.exit(1)
  }
  return { ownerEmail }
}

export async function signedInClient(ownerEmail) {
  const env = loadEnvLocal()
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  const email = env.VITE_DEV_USER_EMAIL
  const password = env.VITE_DEV_USER_PASSWORD
  if (!url || !anon || !email || !password) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_DEV_USER_EMAIL / VITE_DEV_USER_PASSWORD in .env.local')
    process.exit(1)
  }
  if (email !== ownerEmail) {
    console.error(`Safety stop: --owner-email (${ownerEmail}) != dev account in .env.local (${email})`)
    process.exit(1)
  }
  const supabase = createClient(url, anon)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    console.error('Sign-in failed:', error?.message)
    process.exit(1)
  }
  console.log(`Signed in as ${data.user.email} (${data.user.id}) — RLS scopes all writes to this account.`)
  return { supabase, userId: data.user.id }
}

// Local YYYY-MM-DD (never toISOString().slice — Israel TZ law, src/lib/format)
export function localISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addMonthsClamped(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(d.getDate(), last))
  return r
}
