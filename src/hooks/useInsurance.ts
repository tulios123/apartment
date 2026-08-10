import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { readCache, writeCache } from '../lib/queryCache'
import type { InsurancePolicy } from '../types'
import { latestOnly } from '../lib/latestOnly'

export function useInsurance() {
  const { user } = useAuth()
  const cacheKey = user ? `insurance:${user.id}` : null
  const [policies, setPolicies] = useState<InsurancePolicy[]>(() => readCache<InsurancePolicy[]>(cacheKey) ?? [])
  const [loading, setLoading] = useState(() => readCache<InsurancePolicy[]>(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)
  // SW-12: only the LATEST fetch (effect or manual refetch) may commit state.
  const guard = useRef(latestOnly())

  const fetch = useCallback(async () => {
    if (!user) return
    const fresh = guard.current.start()
    const cached = readCache<InsurancePolicy[]>(cacheKey)
    if (cached) setPolicies(cached)
    setLoading(cached == null)
    setError(null)
    const { data, error: err } = await supabase
      .from('insurance_policies')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
    if (!fresh()) return   // superseded by a newer fetch (or unmounted) — don't overwrite
    if (err) setError(err.message)
    else { setPolicies(data ?? []); writeCache<InsurancePolicy[]>(cacheKey, data ?? []) }
    setLoading(false)
  }, [user?.id, cacheKey])

  useEffect(() => { fetch(); return () => guard.current.invalidate() }, [fetch])

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
