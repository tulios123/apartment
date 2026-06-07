import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { OWNER_ID } from '../lib/constants'
import type { RecurringItem } from '../types'

export function useRecurringItems() {
  const [items, setItems] = useState<RecurringItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('owner_id', OWNER_ID)
      .order('direction', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { items, loading, error, refetch: fetch }
}

export async function createRecurringItem(
  data: Omit<RecurringItem, 'id' | 'owner_id' | 'created_at'>
) {
  return supabase.from('recurring_items').insert({ ...data, owner_id: OWNER_ID })
}

export async function updateRecurringItem(
  id: string,
  data: Partial<Omit<RecurringItem, 'id' | 'owner_id' | 'created_at'>>
) {
  return supabase
    .from('recurring_items')
    .update(data)
    .eq('id', id)
    .eq('owner_id', OWNER_ID)
}

export async function deleteRecurringItem(id: string) {
  return supabase
    .from('recurring_items')
    .delete()
    .eq('id', id)
    .eq('owner_id', OWNER_ID)
}
