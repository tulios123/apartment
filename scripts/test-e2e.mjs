import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabase = createClient(
  'https://bjholzkesnzkbogxmurw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaG9semtlc256a2JvZ3htdXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjA2MjcsImV4cCI6MjA5NjM5NjYyN30.OOCqgclG4gwy8RLfST0GqFm8BI0g2adu1INQfFdqedo'
)

const OWNER_ID = '00000000-0000-0000-0000-000000000001'
let passed = 0
let failed = 0

function ok(label) { console.log(`  ✓ ${label}`); passed++ }
function fail(label, err) { console.log(`  ✗ ${label}: ${err}`); failed++ }

console.log('\n── transactions ──')

// Create transaction
const { data: tx, error: txErr } = await supabase
  .from('transactions')
  .insert({ owner_id: OWNER_ID, direction: 'expense', amount: 99, date: '2026-06-07', category: 'תיקונים', description: 'test', payment_method: 'cash' })
  .select()
  .single()

if (txErr || !tx) { fail('create transaction', txErr?.message); process.exit(1) }
ok('create transaction')

// Read it back
const { data: txRead, error: txReadErr } = await supabase
  .from('transactions').select('*').eq('id', tx.id).single()
if (txReadErr || txRead.payment_method !== 'cash') fail('read transaction + payment_method', txReadErr?.message)
else ok('read transaction + payment_method')

console.log('\n── storage / receipt ──')

// Upload a tiny test file
const testFile = Buffer.from('fake-receipt-content')
const storagePath = `${OWNER_ID}/receipts/${tx.id}.txt`
const { error: uploadErr } = await supabase.storage
  .from('documents')
  .upload(storagePath, testFile, { contentType: 'text/plain', upsert: true })

if (uploadErr) fail('upload receipt to storage', uploadErr.message)
else ok('upload receipt to storage')

// Create document record
const { data: doc, error: docErr } = await supabase
  .from('documents')
  .insert({ owner_id: OWNER_ID, transaction_id: tx.id, type: 'receipt', name: 'test.txt', storage_path: storagePath, date: '2026-06-07' })
  .select()
  .single()

if (docErr || !doc) fail('create document record', docErr?.message)
else ok('create document record')

// Link document to transaction
if (doc) {
  const { error: linkErr } = await supabase
    .from('transactions').update({ document_id: doc.id }).eq('id', tx.id)
  if (linkErr) fail('link document to transaction', linkErr.message)
  else ok('link document to transaction')
}

// Get signed URL
const { data: signed, error: signedErr } = await supabase.storage
  .from('documents').createSignedUrl(storagePath, 3600)
if (signedErr || !signed?.signedUrl) fail('get signed URL', signedErr?.message)
else ok('get signed URL')

console.log('\n── recurring items ──')

const { data: ri, error: riErr } = await supabase
  .from('recurring_items')
  .insert({ owner_id: OWNER_ID, direction: 'expense', amount: 5000, category: 'משכנתא – בנק', day_of_month: 1, start_date: '2026-01-01', execution_type: 'automatic', payment_method: 'standing_order', renewal_alert_days: [90, 30] })
  .select()
  .single()

if (riErr || !ri) fail('create recurring item', riErr?.message)
else ok('create recurring item')

console.log('\n── cleanup ──')

// Delete test data
if (doc) await supabase.from('documents').delete().eq('id', doc.id)
await supabase.from('transactions').delete().eq('id', tx.id)
if (ri) await supabase.from('recurring_items').delete().eq('id', ri.id)
await supabase.storage.from('documents').remove([storagePath])
ok('cleaned up test data')

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
