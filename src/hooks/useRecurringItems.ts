import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { RecurringItem } from '../types'

export function useRecurringItems() {
  const { user } = useAuth()
  const [items, setItems] = useState<RecurringItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('owner_id', user.id)
      .order('direction', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setItems(data ?? [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetch() }, [fetch])

  return { items, loading, error, refetch: fetch }
}

async function getOwnerId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export async function createRecurringItem(
  data: Omit<RecurringItem, 'id' | 'owner_id' | 'created_at'>
) {
  const ownerId = await getOwnerId()
  return supabase.from('recurring_items').insert({ ...data, owner_id: ownerId })
}

export async function updateRecurringItem(
  id: string,
  data: Partial<Omit<RecurringItem, 'id' | 'owner_id' | 'created_at'>>
) {
  const ownerId = await getOwnerId()
  return supabase.from('recurring_items').update(data).eq('id', id).eq('owner_id', ownerId)
}

export async function deleteRecurringItem(id: string) {
  const ownerId = await getOwnerId()
  return supabase.from('recurring_items').delete().eq('id', id).eq('owner_id', ownerId)
}
