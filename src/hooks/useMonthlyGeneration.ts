import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { monthEndISO, todayISO } from '../lib/format'

const GENERATION_KEY = 'monthly_generation'

// Guards against concurrent runs (React StrictMode double-invokes effects in
// dev, and two mounts/tabs could race) — without this both runs read "no
// existing rows" before either inserts, producing duplicate generated tasks.
let inFlight = false

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

export function useMonthlyGeneration() {
  useEffect(() => {
    const key = currentMonthKey()
    if (localStorage.getItem(GENERATION_KEY) === key) return
    if (inFlight) return
    inFlight = true
    generate(key).finally(() => { inFlight = false })
  }, [])
}

async function generate(monthKey: string) {
  try {
    await runGeneration()
    localStorage.setItem(GENERATION_KEY, monthKey)
  } catch {
    // Don't set the key — next mount will retry
  }
}

async function runGeneration() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const ownerId = user.id

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = monthEndISO(year, month)

  const { data: items } = await supabase
    .from('recurring_items')
    .select('*')
    .eq('owner_id', ownerId)
    .lte('start_date', monthEnd)
    .or(`end_date.is.null,end_date.gte.${monthStart}`)

  if (!items || items.length === 0) return

  const { data: existingTx } = await supabase
    .from('transactions')
    .select('recurring_item_id')
    .eq('owner_id', ownerId)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .not('recurring_item_id', 'is', null)

  const generatedIds = new Set((existingTx ?? []).map(t => t.recurring_item_id))

  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('recurring_item_id')
    .eq('owner_id', ownerId)
    .gte('due_date', monthStart)
    .lte('due_date', monthEnd)
    .eq('source', 'recurring_item')
    .not('recurring_item_id', 'is', null)

  const taskIds = new Set((existingTasks ?? []).map(t => t.recurring_item_id))

  const newTransactions: object[] = []
  const newTasks: object[] = []

  for (const item of items) {
    const txDate = `${year}-${String(month).padStart(2, '0')}-${String(item.day_of_month).padStart(2, '0')}`

    if (item.execution_type === 'automatic') {
      if (!generatedIds.has(item.id)) {
        newTransactions.push({
          owner_id: ownerId,
          recurring_item_id: item.id,
          contract_id: item.contract_id,
          direction: item.direction,
          amount: item.amount,
          date: txDate,
          category: item.category,
          description: item.payee ?? null,
          document_id: null,
        })
      }
    } else {
      if (!taskIds.has(item.id)) {
        // Rent paid by post-dated checks → the monthly action is depositing the
        // check, so label it that way (taskFollowup still treats it as rent income).
        const isCheckDeposit = item.direction === 'income' && item.payment_method === 'check'
        const title = isCheckDeposit
          ? `הפקדת צ׳ק שכר דירה${item.payee ? ` – ${item.payee}` : ''}`
          : `${item.direction === 'income' ? 'גביית' : 'תשלום'} ${item.category}${item.payee ? ` – ${item.payee}` : ''}`
        newTasks.push({
          owner_id: ownerId,
          recurring_item_id: item.id,
          title,
          due_date: txDate,
          category: 'כללי',
          status: 'open',
          source: 'recurring_item',
          is_recurring: true,
        })
      }
    }
  }

  if (newTransactions.length > 0) await supabase.from('transactions').insert(newTransactions)
  if (newTasks.length > 0) await supabase.from('tasks').insert(newTasks)

  // Renewal alerts: create a task when a contract is within its alert window.
  // todayStr must be the LOCAL date (Israel UTC+2/+3) — toISOString() is UTC and
  // would roll back a day in the small hours, mis-dating the alert and its window.
  const today = new Date()
  const todayStr = todayISO()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, property_id, company_name, end_date, renewal_alert_days')
    .eq('owner_id', ownerId)
    .gte('end_date', todayStr)

  for (const contract of contracts ?? []) {
    const daysLeft = Math.ceil((new Date(contract.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const alertDays: number[] = contract.renewal_alert_days ?? [90, 30]
    const maxAlert = Math.max(...alertDays)
    if (daysLeft > maxAlert) continue

    // Skip if an open renewal task already exists for this property
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('source', 'renewal')
      .eq('property_id', contract.property_id)
      .eq('status', 'open')
      .gte('due_date', todayStr)
      .limit(1)

    if (existing && existing.length > 0) continue

    await supabase.from('tasks').insert({
      owner_id: ownerId,
      property_id: contract.property_id,
      title: `חידוש חוזה עם ${contract.company_name} – נותרו ${daysLeft} ימים`,
      due_date: todayStr,
      category: 'כללי',
      status: 'open',
      source: 'renewal',
      is_recurring: false,
      recurrence_days: null,
      recurring_item_id: null,
      transaction_id: null,
    })
  }
}
