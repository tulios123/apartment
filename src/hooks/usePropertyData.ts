import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Property, Contract, ContractUtility, UtilityPayer } from '../types'

export interface PropertyData {
  property: Property | null
  contracts: Contract[]
  utilities: ContractUtility[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePropertyData(): PropertyData {
  const { user } = useAuth()
  const [property, setProperty] = useState<Property | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [utilities, setUtilities] = useState<ContractUtility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  const fetch = useCallback(async () => {
    if (!user) return
    if (!initialized.current) setLoading(true)
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
      setProperty(prop)

      if (prop) {
        const { data: ctrcts, error: ce } = await supabase
          .from('contracts')
          .select('*')
          .eq('property_id', prop.id)
          .order('end_date', { ascending: false })
        if (ce) throw ce
        const cs = ctrcts ?? []
        setContracts(cs)

        if (cs.length > 0) {
          const { data: utils, error: ue } = await supabase
            .from('contract_utilities')
            .select('*')
            .in('contract_id', cs.map(c => c.id))
          if (ue) throw ue
          setUtilities(utils ?? [])
        } else {
          setUtilities([])
        }
      } else {
        setContracts([])
        setUtilities([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      initialized.current = true
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  return { property, contracts, utilities, loading, error, refetch: fetch }
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
