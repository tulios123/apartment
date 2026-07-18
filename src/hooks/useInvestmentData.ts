import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { interestToDate } from '../lib/mortgage'
import { loanInterestToDate } from '../lib/loans'
import { rentReceivedToDate } from '../lib/projections'
import { readCache, writeCache } from '../lib/queryCache'
import { INTEREST_CATEGORY, MAINTENANCE_CATEGORY } from '../lib/constants'
import type { InvestmentCost, MortgageTrack, Contract, Loan } from '../types'
import { latestOnly } from '../lib/latestOnly'

type InvestmentSnapshot = { costs: InvestmentCost[]; rentReceived: number; interestPaid: number; maintenance: number }

export interface InvestmentData {
  costs: InvestmentCost[]
  totalInvested: number
  rentReceived: number
  interestPaid: number
  maintenance: number
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useInvestmentData(): InvestmentData {
  const { user } = useAuth()
  const cacheKey = user ? `investment:${user.id}` : null
  const [costs, setCosts] = useState<InvestmentCost[]>(() => readCache<InvestmentSnapshot>(cacheKey)?.costs ?? [])
  const [rentReceived, setRentReceived] = useState(() => readCache<InvestmentSnapshot>(cacheKey)?.rentReceived ?? 0)
  const [interestPaid, setInterestPaid] = useState(() => readCache<InvestmentSnapshot>(cacheKey)?.interestPaid ?? 0)
  const [maintenance, setMaintenance] = useState(() => readCache<InvestmentSnapshot>(cacheKey)?.maintenance ?? 0)
  const [loading, setLoading] = useState(() => readCache<InvestmentSnapshot>(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)
  // SW-12: only the LATEST fetch (effect or manual refetch) may commit state.
  const guard = useRef(latestOnly())

  const fetch = useCallback(async () => {
    if (!user) return
    const fresh = guard.current.start()
    const cached = readCache<InvestmentSnapshot>(cacheKey)
    if (cached) {
      setCosts(cached.costs); setRentReceived(cached.rentReceived)
      setInterestPaid(cached.interestPaid); setMaintenance(cached.maintenance)
    }
    setLoading(cached == null)
    setError(null)
    try {
      const [costsRes, txRes, tracksRes, contractsRes, loansRes] = await Promise.all([
        supabase.from('investment_costs').select('*').eq('owner_id', user.id).order('created_at'),
        supabase.from('transactions').select('direction, amount, category').eq('owner_id', user.id),
        supabase.from('mortgage_tracks').select('*').eq('owner_id', user.id),
        supabase.from('contracts').select('start_date, end_date, monthly_rent').eq('owner_id', user.id),
        supabase.from('loans').select('*').eq('owner_id', user.id),
      ])
      if (costsRes.error) throw costsRes.error
      if (txRes.error) throw txRes.error
      // ב4: these three used to degrade to [] on error — the screen then presented
      // WRONG money (rent 0, interest 0) as truth, and even cached it. Fail loudly;
      // the page shows its error state and the cached snapshot stays untouched.
      if (tracksRes.error) throw tracksRes.error
      if (contractsRes.error) throw contractsRes.error
      if (loansRes.error) throw loansRes.error

      // numeric(14,2) columns arrive as STRINGS from supabase-js — coerce at the
      // boundary so the reduces below add numbers, not concatenate strings.
      const txs = (txRes.data ?? []).map(t => ({ ...t, amount: Number(t.amount) || 0 }))
      const mortgageTracks = (tracksRes.data ?? []) as MortgageTrack[]
      const contracts = (contractsRes.data ?? []) as Contract[]
      const loans = (loansRes.data ?? []) as Loan[]

      const nextCosts = (costsRes.data ?? []).map(c => ({ ...c, amount: Number(c.amount) || 0 }))
      const nextRent = rentReceivedToDate(contracts)
      const manualInterest = txs.filter(t => t.direction === 'expense' && t.category === INTEREST_CATEGORY).reduce((s, t) => s + t.amount, 0)
      const loansInterest = loans.reduce((s, l) => s + loanInterestToDate(l), 0)
      // N8: a hand-logged 'ריבית' expense describes the SAME financing the schedules
      // already model — summing both double-counted interest. When a schedule exists
      // it is the source of truth; manual entries only fill the gap when nothing is
      // modeled (no tracks and no loans).
      const scheduleInterest = interestToDate(mortgageTracks) + loansInterest
      const nextInterest = mortgageTracks.length > 0 || loans.length > 0 ? scheduleInterest : manualInterest
      const nextMaintenance = txs.filter(t => t.direction === 'expense' && t.category === MAINTENANCE_CATEGORY).reduce((s, t) => s + t.amount, 0)

      if (!fresh()) return   // superseded by a newer fetch (or unmounted) — don't overwrite
      setCosts(nextCosts)
      setRentReceived(nextRent)
      setInterestPaid(nextInterest)
      setMaintenance(nextMaintenance)
      writeCache<InvestmentSnapshot>(cacheKey, { costs: nextCosts, rentReceived: nextRent, interestPaid: nextInterest, maintenance: nextMaintenance })
    } catch (e) {
      if (fresh()) setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      if (fresh()) setLoading(false)
    }
  }, [user?.id, cacheKey])

  useEffect(() => { fetch(); return () => guard.current.invalidate() }, [fetch])

  const totalInvested = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0)  // guard stale string-amount cache too

  return { costs, totalInvested, rentReceived, interestPaid, maintenance, loading, error, refetch: fetch }
}

export async function upsertInvestmentCost(data: {
  id?: string
  owner_id: string
  category: string
  label: string | null
  amount: number
  notes?: string | null
}): Promise<InvestmentCost> {
  if (data.id) {
    const { data: row, error } = await supabase
      .from('investment_costs')
      .update({ amount: data.amount, label: data.label, notes: data.notes ?? null })
      .eq('id', data.id)
      .select()
      .single()
    if (error) throw error
    return row
  } else {
    const { data: row, error } = await supabase
      .from('investment_costs')
      .insert({ owner_id: data.owner_id, category: data.category, label: data.label ?? null, amount: data.amount, notes: data.notes ?? null })
      .select()
      .single()
    if (error) throw error
    return row
  }
}

export async function deleteInvestmentCost(id: string): Promise<void> {
  const { error } = await supabase.from('investment_costs').delete().eq('id', id)
  if (error) throw error
}
