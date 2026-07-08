import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { readCache, writeCache } from '../lib/queryCache'
import type { Property, Contract, ContractUtility, UtilityPayer } from '../types'

type PropertySnapshot = { property: Property | null; contracts: Contract[]; utilities: ContractUtility[] }

export interface PropertyData {
  property: Property | null
  contracts: Contract[]
  utilities: ContractUtility[]
  loading: boolean
  error: string | null
  refetch: () => void
  patchUtility: (contractId: string, utility: string, patch: Partial<ContractUtility>) => void
}

export function usePropertyData(): PropertyData {
  const { user } = useAuth()
  const cacheKey = user ? `property:${user.id}` : null
  const [property, setProperty] = useState<Property | null>(() => readCache<PropertySnapshot>(cacheKey)?.property ?? null)
  const [contracts, setContracts] = useState<Contract[]>(() => readCache<PropertySnapshot>(cacheKey)?.contracts ?? [])
  const [utilities, setUtilities] = useState<ContractUtility[]>(() => readCache<PropertySnapshot>(cacheKey)?.utilities ?? [])
  const [loading, setLoading] = useState(() => readCache<PropertySnapshot>(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    // Show cached data immediately and refresh silently; only block on a skeleton
    // when there's nothing cached yet for this account.
    const cached = readCache<PropertySnapshot>(cacheKey)
    if (cached) {
      setProperty(cached.property); setContracts(cached.contracts); setUtilities(cached.utilities)
    }
    setLoading(cached == null)
    setError(null)
    try {
      const { data: props, error: pe } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at')
        .limit(1)
      if (pe) throw pe
      const prop = props?.[0] ?? null

      let nextContracts: Contract[] = []
      let nextUtilities: ContractUtility[] = []
      if (prop) {
        const { data: ctrcts, error: ce } = await supabase
          .from('contracts')
          .select('*')
          .eq('property_id', prop.id)
          .order('end_date', { ascending: false })
        if (ce) throw ce
        nextContracts = ctrcts ?? []

        if (nextContracts.length > 0) {
          const { data: utils, error: ue } = await supabase
            .from('contract_utilities')
            .select('*')
            .in('contract_id', nextContracts.map(c => c.id))
          if (ue) throw ue
          nextUtilities = utils ?? []
        }
      }
      setProperty(prop); setContracts(nextContracts); setUtilities(nextUtilities)
      writeCache<PropertySnapshot>(cacheKey, { property: prop, contracts: nextContracts, utilities: nextUtilities })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      setLoading(false)
    }
  }, [user?.id, cacheKey])

  useEffect(() => { fetch() }, [fetch])

  const patchUtility = useCallback((contractId: string, utility: string, patch: Partial<ContractUtility>) => {
    setUtilities(prev => {
      const exists = prev.some(u => u.contract_id === contractId && u.utility === utility)
      if (exists) {
        return prev.map(u =>
          u.contract_id === contractId && u.utility === utility ? { ...u, ...patch } : u
        )
      }
      return [...prev, { id: `temp-${contractId}-${utility}`, contract_id: contractId, utility, payer: 'tenant', amount: null, ...patch } as ContractUtility]
    })
  }, [])

  return { property, contracts, utilities, loading, error, refetch: fetch, patchUtility }
}

export interface PropertyInsert {
  owner_id: string
  address: string
  notes: string | null
  buyer_name?: string | null
  block_parcel?: string | null
  purchase_price?: number | null
  purchase_date?: string | null
  key_delivery_date?: string | null
  property_size_sqm?: number | null
  floor?: number | null
  rooms?: number | null
}

export async function createProperty(data: PropertyInsert): Promise<Property> {
  const { data: row, error } = await supabase.from('properties').insert(data).select().single()
  if (error) throw error
  return row
}

export async function updateProperty(id: string, data: Partial<Omit<Property, 'id' | 'owner_id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase.from('properties').update(data).eq('id', id)
  if (error) throw error
}

export async function createContract(data: Omit<Contract, 'id' | 'created_at'>): Promise<Contract> {
  const { data: row, error } = await supabase.from('contracts').insert(data).select().single()
  if (error) throw error
  return row
}

export async function updateContract(id: string, data: Partial<Omit<Contract, 'id' | 'created_at' | 'owner_id' | 'property_id'>>): Promise<void> {
  const { error } = await supabase.from('contracts').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw error
}

export async function upsertUtilities(contractId: string, utilities: { utility: string; payer: UtilityPayer; amount?: number | null }[]): Promise<void> {
  if (utilities.length === 0) return
  const rows = utilities.map(u => ({ contract_id: contractId, utility: u.utility, payer: u.payer, amount: u.amount ?? null }))
  const { error } = await supabase
    .from('contract_utilities')
    .upsert(rows, { onConflict: 'contract_id,utility' })
  if (error) throw error
}
