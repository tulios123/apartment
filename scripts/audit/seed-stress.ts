#!/usr/bin/env npx tsx
// Stress-seed for the night audit. ADDITIVE INSERTS ONLY, every row tagged [STRESS],
// all confined to the signed-in test account by RLS (anon key + password sign-in).
//   npx tsx scripts/audit/seed-stress.ts --owner-email dev@test.local --i-know-this-is-shared-supabase
// Cleanup: scripts/audit/cleanup-stress.ts (same flags) — the owner runs it after his pass.
import { requireFlags, signedInClient, localISO, addMonthsClamped } from './lib.mjs'

const argv = process.argv.slice(2)
const { ownerEmail } = requireFlags(argv)
const { supabase, userId } = await signedInClient(ownerEmail)
const TAG = '[STRESS]'

async function insert(table: string, rows: any[]) {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) { console.error(`${table} insert failed at chunk ${i / 100}: ${error.message}`); process.exit(1) }
  }
  console.log(`${table}: +${rows.length}`)
}

const today = new Date()
const monthStart = (off: number) => new Date(today.getFullYear(), today.getMonth() + off, 1)
const monthEnd = (off: number) => new Date(today.getFullYear(), today.getMonth() + off + 1, 0)

// ---- ~400 transactions across 14 months (months -12..+1), month boundaries,
// extremes 0.01–9,999,999, 200-char descriptions ----
const LONG_DESC = `${TAG} תיאור ארוך במיוחד לבדיקת גלישה — `.padEnd(200, 'א')
const txs: any[] = []
for (let off = -12; off <= 1; off++) {
  const boundaries = [monthStart(off), monthEnd(off)]
  for (const d of boundaries) {
    txs.push({ owner_id: userId, direction: 'expense', amount: 137.5, date: localISO(d), category: 'תיקונים', description: `${TAG} גבול-חודש ${localISO(d)}`, payment_method: 'bit' })
  }
  for (let i = 0; i < 26; i++) {
    const d = new Date(monthStart(off)); d.setDate(1 + ((i * 7) % 27))
    const income = i % 4 === 0
    txs.push({
      owner_id: userId,
      direction: income ? 'income' : 'expense',
      amount: i === 7 ? 0.01 : i === 13 ? 9_999_999 : Math.round((50 + i * 37.33) * 100) / 100,
      date: localISO(d),
      category: income ? 'אחר' : ['תיקונים', 'אחר'][i % 2],
      description: i === 20 ? LONG_DESC : `${TAG} תנועה ${off}/${i}`,
      payment_method: ['bit', 'cash', 'check', 'bank_transfer', 'standing_order'][i % 5],
    })
  }
}
await insert('transactions', txs)

// ---- 25 tasks: overdue / today / future / done ----
const tasks: any[] = []
for (let i = 0; i < 25; i++) {
  const kind = i % 4
  const due = new Date(today)
  due.setDate(due.getDate() + (kind === 0 ? -(i + 2) : kind === 1 ? 0 : i + 3))
  const done = kind === 3
  tasks.push({
    owner_id: userId,
    title: `${TAG} משימה ${i + 1} ${kind === 0 ? '(באיחור)' : kind === 1 ? '(היום)' : done ? '(בוצעה)' : '(עתידית)'}`,
    due_date: localISO(due),
    due_time: i % 5 === 0 ? '09:30' : null,
    category: ['תיקונים ותחזוקה', 'ביקור ובדיקה', 'כללי'][i % 3],
    status: done ? 'done' : 'open',
    source: 'manual',
    is_recurring: false,
    completed_at: done ? new Date().toISOString() : null,
  })
}
await insert('tasks', tasks)

// ---- 15 documents (one tiny PNG uploaded per row, own folder) ----
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const docRows: any[] = []
for (let i = 0; i < 15; i++) {
  const path = `${userId}/stress/stress-${i}.png`
  const { error } = await supabase.storage.from('documents').upload(path, PNG, { contentType: 'image/png', upsert: true })
  if (error) { console.error(`storage upload ${i} failed: ${error.message}`); process.exit(1) }
  docRows.push({
    owner_id: userId,
    type: ['receipt', 'invoice', 'other', 'mortgage_statement', 'rental_contract'][i % 5],
    name: `${TAG} מסמך ${i + 1}`,
    storage_path: path,
    date: localISO(new Date(today.getFullYear(), today.getMonth() - (i % 6), 3 + i)),
  })
}
await insert('documents', docRows)

// ---- a contract ending in 10 days (renewal badge) ----
const endsSoon = new Date(today); endsSoon.setDate(endsSoon.getDate() + 10)
const contractStart = new Date(today.getFullYear() - 1, today.getMonth(), endsSoon.getDate())
await insert('contracts', [{
  owner_id: userId,
  property_id: (await supabase.from('properties').select('id').eq('owner_id', userId).limit(1)).data?.[0]?.id ?? null,
  company_name: `${TAG} שוכר בדיקת-עומס`,
  start_date: localISO(contractStart),
  end_date: localISO(endsSoon),
  monthly_rent: 4321,
  requires_approval: false,
  renewal_alert_days: [60, 30],
}])

// ---- recurring items incl. day_of_month=31 ----
await insert('recurring_items', [
  { owner_id: userId, direction: 'expense', amount: 62.9, category: 'אחר', day_of_month: 31, start_date: localISO(addMonthsClamped(today, -3)), payee: `${TAG} הוראת-קבע יום-31`, execution_type: 'automatic', renewal_alert_days: [] },
  { owner_id: userId, direction: 'expense', amount: 118, category: 'ביטוח', day_of_month: 1, start_date: localISO(addMonthsClamped(today, -2)), end_date: localISO(addMonthsClamped(today, -1)), payee: `${TAG} פריט-עם-עבר end_date`, execution_type: 'automatic', renewal_alert_days: [] },
])

// ---- second mortgage (with grace) + balloon loan ----
const { data: mData, error: mErr } = await supabase.from('mortgages').insert({
  owner_id: userId, lender: `${TAG} בנק בדיקה`, payment_day: 10,
}).select('id').single()
if (mErr || !mData) { console.error('mortgage insert failed:', mErr?.message); process.exit(1) }
await insert('mortgage_tracks', [
  { mortgage_id: mData.id, owner_id: userId, label: `${TAG} מסלול בגרייס`, track_type: 'fixed_unlinked', principal: 250_000, annual_rate: 4.9, term_months: 240, grace_months: 18, start_date: localISO(addMonthsClamped(today, -2)) },
  { mortgage_id: mData.id, owner_id: userId, label: `${TAG} מסלול פריים`, track_type: 'prime', principal: 150_000, annual_rate: 6.0, prime_rate: 6.0, margin: 0, term_months: 300, grace_months: 0, start_date: localISO(addMonthsClamped(today, -2)) },
])
await insert('loans', [{
  owner_id: userId, label: `${TAG} הלוואת בלון`, lender: `${TAG} משפחה`, repayment_type: 'balloon', principal: 80_000, start_date: localISO(addMonthsClamped(today, -6)),
}])

console.log(`\nSeed complete for ${ownerEmail}. Cleanup: npx tsx scripts/audit/cleanup-stress.ts --owner-email ${ownerEmail} --i-know-this-is-shared-supabase`)
