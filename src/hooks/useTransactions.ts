import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { monthEndISO } from '../lib/format'
import type { Transaction } from '../types'

interface Filters {
  year?: number
  month?: number // 1-12
  from?: string // inclusive YYYY-MM-DD; takes precedence over year/month
  to?: string // inclusive YYYY-MM-DD
}

export function useTransactions(filters: Filters = {}) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('owner_id', user.id)
      .order('date', { ascending: false })

    if (filters.from && filters.to) {
      query = query.gte('date', filters.from).lte('date', filters.to)
    } else if (filters.year && filters.month) {
      const from = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
      const to = monthEndISO(filters.year, filters.month)
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
  }, [user?.id, filters.year, filters.month, filters.from, filters.to])

  useEffect(() => { fetch() }, [fetch])

  return { transactions, loading, error, refetch: fetch }
}

async function getOwnerId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export async function createTransaction(
  data: Omit<Transaction, 'id' | 'owner_id' | 'created_at'>
) {
  const ownerId = await getOwnerId()
  return supabase
    .from('transactions')
    .insert({ ...data, owner_id: ownerId })
    .select()
    .single()
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<Transaction, 'id' | 'owner_id' | 'created_at'>>
) {
  const ownerId = await getOwnerId()
  return supabase.from('transactions').update(data).eq('id', id).eq('owner_id', ownerId)
}

export async function deleteTransaction(id: string) {
  const ownerId = await getOwnerId()
  return supabase.from('transactions').delete().eq('id', id).eq('owner_id', ownerId)
}
