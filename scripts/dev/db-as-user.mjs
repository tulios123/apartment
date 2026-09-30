// Sign in as the dev test account and run a small action against the hosted DB,
// under that user's own RLS. Used by the clean-eyes run to set up data states that
// the in-app scenario loader does not cover.
//
// Never takes a service key — everything here is what the signed-in user may do.
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.VITE_DEV_USER_EMAIL
const password = process.env.VITE_DEV_USER_PASSWORD
if (!url || !key || !email || !password) throw new Error('missing VITE_ env')

export const supabase = createClient(url, key, { auth: { persistSession: false } })
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
if (authErr) throw authErr
export const uid = auth.user.id

const { data: members } = await supabase.from('household_members').select('household_id, role')
export const ownerId = members?.[0]?.household_id ?? uid

const cmd = process.argv[2] || 'show'

if (cmd === 'show') {
  for (const t of ['properties', 'contracts', 'mortgages', 'mortgage_tracks', 'loans',
    'investment_costs', 'recurring_items', 'transactions', 'tasks', 'documents', 'insurance_policies']) {
    const { data, error } = await supabase.from(t).select('*').eq('owner_id', ownerId)
    console.log(`${t.padEnd(20)} ${error ? 'ERR ' + error.message : (data?.length ?? 0)}`)
  }
  const { data: p } = await supabase.from('properties').select('*').eq('owner_id', ownerId)
  console.log('\nproperties:', JSON.stringify(p, null, 2))
}

if (cmd === 'wipe') {
  const WIPE = ['transactions', 'tasks', 'documents', 'recurring_items', 'investment_costs',
    'insurance_policies', 'contracts', 'mortgage_tracks', 'mortgages', 'loans', 'properties']
  for (const t of WIPE) {
    const { error } = await supabase.from(t).delete().eq('owner_id', ownerId)
    console.log(`${t.padEnd(20)} ${error ? 'ERR ' + error.message : 'ok'}`)
  }
}

if (cmd === 'partial') {
  // The wizard skipper: address + price only. No mortgage, no contract, no costs.
  const { error } = await supabase.from('properties').insert({
    owner_id: ownerId,
    address: 'ויצמן 12, רמת גן',
    purchase_price: 2_100_000,
    buyer_name: 'חשבון בדיקות',
  })
  console.log(error ? 'ERR ' + error.message : 'partial property created')
}

process.exit(0)
