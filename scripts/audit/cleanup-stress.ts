#!/usr/bin/env npx tsx
// Cleanup for audit-seeded rows. Deletes ONLY rows tagged [STRESS] (or [E2E] with
// --tag E2E) belonging to the signed-in test account, including transactions
// generated from seeded recurring items. Run:
//   npx tsx scripts/audit/cleanup-stress.ts --owner-email dev@test.local --i-know-this-is-shared-supabase [--tag STRESS|E2E]
// (Implemented in plain ESM via lib.mjs so it also runs with `node` if tsx is absent.)
import { requireFlags, signedInClient } from './lib.mjs'

const argv = process.argv.slice(2)
const { ownerEmail } = requireFlags(argv)
const tagIdx = argv.indexOf('--tag')
const TAG = `[${tagIdx >= 0 ? argv[tagIdx + 1] : 'STRESS'}]`

const { supabase, userId } = await signedInClient(ownerEmail)
const like = `%${TAG}%`
let total = 0

async function del(table: string, column: string, extra?: (q: any) => any) {
  let q = supabase.from(table).delete({ count: 'exact' }).eq('owner_id', userId).like(column, like)
  if (extra) q = extra(q)
  const { count, error } = await q
  if (error) { console.error(`${table}: DELETE FAILED — ${error.message}`); process.exitCode = 1; return }
  console.log(`${table}: deleted ${count ?? 0} (${column} like ${TAG})`)
  total += count ?? 0
}

// 1. Transactions generated from tagged recurring items (may not carry the tag themselves)
const { data: recItems, error: recErr } = await supabase
  .from('recurring_items').select('id').eq('owner_id', userId).like('payee', like)
if (recErr) { console.error('recurring_items select failed:', recErr.message); process.exit(1) }
if (recItems && recItems.length) {
  const ids = recItems.map((r: any) => r.id)
  const { count, error } = await supabase.from('transactions').delete({ count: 'exact' })
    .eq('owner_id', userId).in('recurring_item_id', ids)
  if (error) { console.error(`transactions(from recurring): DELETE FAILED — ${error.message}`); process.exitCode = 1 }
  else { console.log(`transactions (generated from ${ids.length} tagged recurring items): deleted ${count ?? 0}`); total += count ?? 0 }
}

// 2. Directly tagged rows, children before parents
await del('transactions', 'description')
await del('tasks', 'title')

// Documents: remove storage objects too
const { data: docs } = await supabase.from('documents').select('id, storage_path').eq('owner_id', userId).like('name', like)
if (docs && docs.length) {
  const { error: stErr } = await supabase.storage.from('documents').remove(docs.map((d: any) => d.storage_path))
  if (stErr) console.error('storage remove warning:', stErr.message)
}
await del('documents', 'name')

await del('recurring_items', 'payee')
await del('insurance_policies', 'notes')
await del('contracts', 'company_name')          // contract_utilities cascade via FK
await del('mortgage_tracks', 'label')
await del('mortgages', 'lender')
await del('loans', 'label')

console.log(`\nDone. ${total} tagged rows removed for ${ownerEmail}.`)
