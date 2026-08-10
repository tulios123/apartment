// Read-only row dump for e2e DB assertions (RLS-scoped to the test account).
// Usage: node scripts/audit/count-rows.mjs table1 table2 ...
// Prints one JSON line (last stdout line): { table: rows[] }
import { signedInClient } from './lib.mjs'

const tables = process.argv.slice(2)
const { supabase, userId } = await signedInClient('dev@test.local')
const out = {}
for (const t of tables) {
  const { data, error } = await supabase.from(t).select('*').eq('owner_id', userId)
  if (error) { console.error(`${t}: ${error.message}`); process.exit(1) }
  out[t] = data
}
console.log(JSON.stringify(out))
