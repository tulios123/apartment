import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { interestToDate } from '../lib/mortgage'
import { loanInterestToDate } from '../lib/loans'
import { rentReceivedToDate } from '../lib/projections'
import { readCache, writeCache } from '../lib/queryCache'
import { INTEREST_CATEGORY, MAINTENANCE_CATEGORY } from '../lib/constants'
import type { InvestmentCost, MortgageTrack, Contract, Loan } from '../types'

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

  const fetch = useCallback(async () => {
    if (!user) return
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

      // numeric(14,2) columns arrive as STRINGS from supabase-js — coerce at the
      // boundary so the reduces below add numbers, not concatenate strings.
      const txs = (txRes.data ?? []).map(t => ({ ...t, amount: Number(t.amount) || 0 }))
      const mortgageTracks = (tracksRes.error ? [] : (tracksRes.data ?? [])) as MortgageTrack[]
      const contracts = (contractsRes.error ? [] : (contractsRes.data ?? [])) as Contract[]
      const loans = (loansRes.error ? [] : (loansRes.data ?? [])) as Loan[]

      const nextCosts = (costsRes.data ?? []).map(c => ({ ...c, amount: Number(c.amount) || 0 }))
      const nextRent = rentReceivedToDate(contracts)
      const manualInterest = txs.filter(t => t.direction === 'expense' && t.category === INTEREST_CATEGORY).reduce((s, t) => s + t.amount, 0)
      const loansInterest = loans.reduce((s, l) => s + loanInterestToDate(l), 0)
      const nextInterest = manualInterest + interestToDate(mortgageTracks) + loansInterest
      const nextMaintenance = txs.filter(t => t.direction === 'expense' && t.category === MAINTENANCE_CATEGORY).reduce((s, t) => s + t.amount, 0)

      setCosts(nextCosts)
      setRentReceived(nextRent)
      setInterestPaid(nextInterest)
      setMaintenance(nextMaintenance)
      writeCache<InvestmentSnapshot>(cacheKey, { costs: nextCosts, rentReceived: nextRent, interestPaid: nextInterest, maintenance: nextMaintenance })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      setLoading(false)
    }
  }, [user?.id, cacheKey])

  useEffect(() => { fetch() }, [fetch])

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
