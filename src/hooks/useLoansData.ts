import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { loanBalance, loanInterestToDate, loanMonthlyPayment } from '../lib/loans'
import { readCache, writeCache } from '../lib/queryCache'
import type { Loan, LoanRepaymentType, TrackType } from '../types'
import { latestOnly } from '../lib/latestOnly'

export interface LoansSummary {
  /** Outstanding balance across monthly_fixed loans (Shpitzer). */
  monthlyBalance: number
  /** Derived (never shown in the loan card) combined Shpitzer monthly payment. */
  monthlyPayment: number
  /** Interest paid to date across monthly_fixed loans. */
  interestPaidToDate: number
  /** Outstanding balloon principal (repaid on sale). */
  balloonOutstanding: number
}

export interface LoansData {
  loans: Loan[]
  monthlyLoans: Loan[]
  balloonLoans: Loan[]
  summary: LoansSummary
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useLoansData(): LoansData {
  const { user } = useAuth()
  const cacheKey = user ? `loans:${user.id}` : null
  const [loans, setLoans] = useState<Loan[]>(() => readCache<Loan[]>(cacheKey) ?? [])
  const [loading, setLoading] = useState(() => readCache<Loan[]>(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)
  // SW-12: only the LATEST fetch (effect or manual refetch) may commit state.
  const guard = useRef(latestOnly())

  const fetch = useCallback(async () => {
    if (!user) return
    const fresh = guard.current.start()
    const cached = readCache<Loan[]>(cacheKey)
    if (cached) setLoans(cached)
    setLoading(cached == null)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('loans')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at')
      if (!fresh()) return   // superseded by a newer fetch (or unmounted) — don't overwrite
      if (err) throw err
      const next = (data ?? []) as Loan[]
      setLoans(next)
      writeCache<Loan[]>(cacheKey, next)
    } catch (e) {
      if (fresh()) setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      if (fresh()) setLoading(false)
    }
  }, [user?.id, cacheKey])

  useEffect(() => { fetch(); return () => guard.current.invalidate() }, [fetch])

  const monthlyLoans = loans.filter(l => l.repayment_type === 'monthly_fixed')
  const balloonLoans = loans.filter(l => l.repayment_type === 'balloon')

  const summary: LoansSummary = {
    monthlyBalance: monthlyLoans.reduce((s, l) => s + loanBalance(l), 0),
    monthlyPayment: monthlyLoans.reduce((s, l) => s + loanMonthlyPayment(l), 0),
    interestPaidToDate: monthlyLoans.reduce((s, l) => s + loanInterestToDate(l), 0),
    balloonOutstanding: balloonLoans.reduce((s, l) => s + (Number(l.principal) || 0), 0),  // numeric col → string; coerce before summing
  }

  return { loans, monthlyLoans, balloonLoans, summary, loading, error, refetch: fetch }
}

export async function upsertLoan(data: {
  id?: string
  owner_id: string
  property_id?: string | null
  label: string | null
  lender: string | null
  repayment_type: LoanRepaymentType
  track_type?: TrackType | null
  principal: number
  annual_rate?: number | null
  prime_rate?: number | null
  margin?: number | null
  term_months?: number | null
  grace_months?: number | null
  start_date?: string | null
  payment_day?: number | null
  notes?: string | null
}): Promise<Loan> {
  const payload = {
    label: data.label,
    lender: data.lender,
    repayment_type: data.repayment_type,
    track_type: data.track_type ?? null,
    principal: data.principal,
    annual_rate: data.annual_rate ?? null,
    prime_rate: data.prime_rate ?? null,
    margin: data.margin ?? null,
    term_months: data.term_months ?? null,
    grace_months: data.grace_months ?? null,
    start_date: data.start_date ?? null,
    payment_day: data.payment_day ?? null,
    notes: data.notes ?? null,
  }
  if (data.id) {
    const { data: row, error } = await supabase
      .from('loans').update(payload).eq('id', data.id).select().single()
    if (error) throw error
    return row as Loan
  } else {
    const { data: row, error } = await supabase
      .from('loans')
      .insert({ owner_id: data.owner_id, property_id: data.property_id ?? null, ...payload })
      .select().single()
    if (error) throw error
    return row as Loan
  }
}

export async function deleteLoan(id: string): Promise<void> {
  const { error } = await supabase.from('loans').delete().eq('id', id)
  if (error) throw error
}
