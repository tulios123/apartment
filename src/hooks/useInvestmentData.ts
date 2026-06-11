import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { interestToDate } from '../lib/mortgage'
import type { InvestmentCost, MortgageTrack, Contract } from '../types'

function rentFromContracts(contracts: Contract[]): number {
  const today = new Date()
  let total = 0
  for (const c of contracts) {
    const start = new Date(c.start_date)
    const cap = new Date(Math.min(new Date(c.end_date).getTime(), today.getTime()))
    if (cap < start) continue
    const months = (cap.getFullYear() - start.getFullYear()) * 12 + (cap.getMonth() - start.getMonth()) + 1
    total += Math.max(0, months) * c.monthly_rent
  }
  return total
}

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
  const [costs, setCosts] = useState<InvestmentCost[]>([])
  const [rentReceived, setRentReceived] = useState(0)
  const [interestPaid, setInterestPaid] = useState(0)
  const [maintenance, setMaintenance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [costsRes, txRes, tracksRes, contractsRes] = await Promise.all([
        supabase.from('investment_costs').select('*').eq('owner_id', user.id).order('created_at'),
        supabase.from('transactions').select('direction, amount, category').eq('owner_id', user.id),
        supabase.from('mortgage_tracks').select('*').eq('owner_id', user.id),
        supabase.from('contracts').select('start_date, end_date, monthly_rent').eq('owner_id', user.id),
      ])
      if (costsRes.error) throw costsRes.error
      if (txRes.error) throw txRes.error

      setCosts(costsRes.data ?? [])

      const txs = txRes.data ?? []
      const mortgageTracks = (tracksRes.error ? [] : (tracksRes.data ?? [])) as MortgageTrack[]
      const contracts = (contractsRes.error ? [] : (contractsRes.data ?? [])) as Contract[]

      setRentReceived(rentFromContracts(contracts))
      const manualInterest = txs.filter(t => t.direction === 'expense' && t.category === 'ריבית').reduce((s, t) => s + t.amount, 0)
      setInterestPaid(manualInterest + interestToDate(mortgageTracks))
      setMaintenance(txs.filter(t => t.direction === 'expense' && t.category === 'תיקונים').reduce((s, t) => s + t.amount, 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const totalInvested = costs.reduce((s, c) => s + c.amount, 0)

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
