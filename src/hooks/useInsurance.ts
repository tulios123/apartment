import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { InsurancePolicy } from '../types'

export function useInsurance() {
  const { user } = useAuth()
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('insurance_policies')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
    if (err) setError(err.message)
    else setPolicies(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  return { policies, loading, error, refetch: fetch }
}

export async function createInsurancePolicy(data: Omit<InsurancePolicy, 'id' | 'created_at'>) {
  const { data: row, error } = await supabase
    .from('insurance_policies')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return row as InsurancePolicy
}

export async function updateInsurancePolicy(id: string, data: Partial<InsurancePolicy>) {
  const { error } = await supabase
    .from('insurance_policies')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

export async function deleteInsurancePolicy(id: string) {
  const { error } = await supabase
    .from('insurance_policies')
    .delete()
    .eq('id', id)
  if (error) throw error
}
