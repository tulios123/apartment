import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

const GENERATION_KEY = 'monthly_generation'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

export function useMonthlyGeneration() {
  useEffect(() => {
    const key = currentMonthKey()
    if (localStorage.getItem(GENERATION_KEY) === key) return
    generate(key)
  }, [])
}

async function generate(monthKey: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const ownerId = user.id

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)

  const { data: items } = await supabase
    .from('recurring_items')
    .select('*')
    .eq('owner_id', ownerId)
    .lte('start_date', monthEnd)
    .or(`end_date.is.null,end_date.gte.${monthStart}`)

  if (!items || items.length === 0) {
    localStorage.setItem(GENERATION_KEY, monthKey)
    return
  }

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
        const label = item.direction === 'income' ? 'גביית' : 'תשלום'
        newTasks.push({
          owner_id: ownerId,
          recurring_item_id: item.id,
          title: `${label} ${item.category}${item.payee ? ` – ${item.payee}` : ''}`,
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

  localStorage.setItem(GENERATION_KEY, monthKey)
}
