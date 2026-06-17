import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { loanBalance } from '../lib/loans'
import type { Loan, LoanRepaymentType } from '../types'

export interface LoansSummary {
  /** Outstanding balance across monthly_fixed loans. */
  monthlyBalance: number
  /** Combined fixed monthly repayment across monthly_fixed loans. */
  monthlyPayment: number
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
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('loans')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at')
      if (err) throw err
      setLoans((data ?? []) as Loan[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const monthlyLoans = loans.filter(l => l.repayment_type === 'monthly_fixed')
  const balloonLoans = loans.filter(l => l.repayment_type === 'balloon')

  const summary: LoansSummary = {
    monthlyBalance: monthlyLoans.reduce((s, l) => s + loanBalance(l), 0),
    monthlyPayment: monthlyLoans.reduce((s, l) => s + (l.monthly_payment ?? 0), 0),
    balloonOutstanding: balloonLoans.reduce((s, l) => s + l.principal, 0),
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
  principal: number
  monthly_payment?: number | null
  term_months?: number | null
  start_date?: string | null
  notes?: string | null
}): Promise<Loan> {
  const payload = {
    label: data.label,
    lender: data.lender,
    repayment_type: data.repayment_type,
    principal: data.principal,
    monthly_payment: data.monthly_payment ?? null,
    term_months: data.term_months ?? null,
    start_date: data.start_date ?? null,
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
