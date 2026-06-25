import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { readCache, writeCache } from '../lib/queryCache'
import { RENT_CATEGORIES } from '../lib/constants'
import type { RecurringItem } from '../types'

export function useRecurringItems() {
  const { user } = useAuth()
  const cacheKey = user ? `recurring:${user.id}` : null
  const [items, setItems] = useState<RecurringItem[]>(() => readCache<RecurringItem[]>(cacheKey) ?? [])
  const [loading, setLoading] = useState(() => readCache<RecurringItem[]>(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    const cached = readCache<RecurringItem[]>(cacheKey)
    if (cached) setItems(cached)
    setLoading(cached == null)
    setError(null)
    const { data, error } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('owner_id', user.id)
      .order('direction', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else { setItems(data ?? []); writeCache<RecurringItem[]>(cacheKey, data ?? []) }
    setLoading(false)
  }, [user?.id, cacheKey])

  useEffect(() => { fetch() }, [fetch])

  return { items, loading, error, refetch: fetch }
}

async function getOwnerId(): Promise<string> {
  // Cached session (local) instead of getUser() — the latter makes a network
  // round trip to validate the token, slowing every write (e.g. the onboarding
  // rent-reminder sync).
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not authenticated')
  return session.user.id
}

export async function createRecurringItem(
  data: Omit<RecurringItem, 'id' | 'owner_id' | 'created_at'>
) {
  const ownerId = await getOwnerId()
  const { data: inserted, error } = await supabase
    .from('recurring_items')
    .insert({ ...data, owner_id: ownerId })
    .select()
    .single()
  if (error) throw error
  return inserted
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

type ContractRentInput = {
  id: string
  monthly_rent: number
  start_date: string
  end_date: string | null
  company_name: string
  payment_method: string | null
  requires_approval: boolean
}

/**
 * Keep a contract's rent-collection recurring item in sync with its
 * `requires_approval` flag — the single source of truth for rent approval.
 * - requires_approval=true  → ensure exactly one 'requires_approval' rent item exists
 *   (this is what generates the monthly "גביית שכר דירה" approval task).
 * - requires_approval=false → rent is automatic/virtual only; remove any rent item.
 * Preserves an existing item's day_of_month; defaults to the 1st for new items.
 */
export async function syncRentRecurringItem(
  contract: ContractRentInput,
  opts?: { dayOfMonth?: number },
) {
  const ownerId = await getOwnerId()
  const rentCats = RENT_CATEGORIES as readonly string[]
  const { data: existing } = await supabase
    .from('recurring_items')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('contract_id', contract.id)
    .eq('direction', 'income')
  const rentItems = (existing ?? []).filter(i => rentCats.includes(i.category))

  if (!contract.requires_approval) {
    if (rentItems.length > 0) {
      await supabase.from('recurring_items').delete().in('id', rentItems.map(i => i.id))
    }
    return
  }

  const fields = {
    contract_id: contract.id,
    direction: 'income' as const,
    amount: contract.monthly_rent,
    category: RENT_CATEGORIES[0],
    start_date: contract.start_date,
    end_date: contract.end_date,
    payee: contract.company_name || null,
    execution_type: 'requires_approval' as const,
    payment_method: contract.payment_method ?? null,
  }

  if (rentItems.length > 0) {
    await supabase.from('recurring_items').update(fields).eq('id', rentItems[0].id)
    if (rentItems.length > 1) {
      // Collapse any accidental duplicates.
      await supabase.from('recurring_items').delete().in('id', rentItems.slice(1).map(i => i.id))
    }
  } else {
    await supabase.from('recurring_items').insert({
      ...fields,
      owner_id: ownerId,
      day_of_month: opts?.dayOfMonth ?? 1,
      renewal_alert_days: [90, 30],
    })
  }
}

/** Remove rent recurring items linked to a contract (call before deleting the contract). */
export async function deleteRentRecurringItems(contractId: string) {
  const ownerId = await getOwnerId()
  const rentCats = RENT_CATEGORIES as readonly string[]
  const { data: existing } = await supabase
    .from('recurring_items')
    .select('id, category')
    .eq('owner_id', ownerId)
    .eq('contract_id', contractId)
    .eq('direction', 'income')
  const ids = (existing ?? []).filter(i => rentCats.includes(i.category)).map(i => i.id)
  if (ids.length > 0) {
    // Throw on failure so the caller (contract delete) aborts before removing the
    // contract — otherwise a failed rent-item delete would silently orphan items
    // that keep generating rent tasks.
    const { error } = await supabase.from('recurring_items').delete().in('id', ids)
    if (error) throw error
  }
}
