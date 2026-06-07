import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { OWNER_ID } from '../lib/constants'
import type { Transaction } from '../types'

interface Filters {
  year?: number
  month?: number // 1-12
}

export function useTransactions(filters: Filters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('owner_id', OWNER_ID)
      .order('date', { ascending: false })

    if (filters.year && filters.month) {
      const from = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
      const to = new Date(filters.year, filters.month, 0)
        .toISOString()
        .slice(0, 10)
      query = query.gte('date', from).lte('date', to)
    } else if (filters.year) {
      query = query
        .gte('date', `${filters.year}-01-01`)
        .lte('date', `${filters.year}-12-31`)
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setTransactions(data ?? [])
    setLoading(false)
  }, [filters.year, filters.month])

  useEffect(() => { fetch() }, [fetch])

  return { transactions, loading, error, refetch: fetch }
}

export async function createTransaction(
  data: Omit<Transaction, 'id' | 'owner_id' | 'created_at'>
) {
  return supabase.from('transactions').insert({ ...data, owner_id: OWNER_ID })
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<Transaction, 'id' | 'owner_id' | 'created_at'>>
) {
  return supabase.from('transactions').update(data).eq('id', id).eq('owner_id', OWNER_ID)
}

export async function deleteTransaction(id: string) {
  return supabase.from('transactions').delete().eq('id', id).eq('owner_id', OWNER_ID)
}
