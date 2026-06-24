import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { rentReceivedToDate, mortgagePaidToDate } from '../lib/projections'
import { todayISO, monthDayISO } from '../lib/format'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../lib/constants'
import type { Transaction, Task, Contract, MortgageTrack } from '../types'

export interface UpcomingRenewal {
  contract: Contract
  daysLeft: number
}

export interface DashboardStats {
  totalIncome: number
  totalExpense: number
  balance: number
  recentTransactions: Transaction[]
  openTasks: Task[]
  upcomingRenewals: UpcomingRenewal[]
  loading: boolean
  error: string | null
}

export function useDashboardStats(): DashboardStats {
  const { user } = useAuth()
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [openTasks, setOpenTasks] = useState<Task[]>([])
  const [upcomingRenewals, setUpcomingRenewals] = useState<UpcomingRenewal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const todayStr = todayISO() // LOCAL date — not toISOString (UTC rolls back a day)
        const in90 = new Date(); in90.setDate(in90.getDate() + 90)
        const in90Str = monthDayISO(in90)

        const [txRes, tasksRes, renewalRes, allContractsRes, tracksRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('id, direction, amount, date, category, description, payment_method, contract_id, recurring_item_id, document_id, owner_id, created_at')
            .eq('owner_id', user!.id)
            .order('date', { ascending: false }),
          supabase
            .from('tasks')
            .select('*')
            .eq('owner_id', user!.id)
            .eq('status', 'open')
            .order('due_date', { ascending: true }),
          supabase
            .from('contracts')
            .select('*')
            .eq('owner_id', user!.id)
            .gte('end_date', todayStr)
            .lte('end_date', in90Str)
            .order('end_date', { ascending: true }),
          supabase.from('contracts').select('start_date, end_date, monthly_rent').eq('owner_id', user!.id),
          supabase.from('mortgage_tracks').select('*').eq('owner_id', user!.id),
        ])

        if (txRes.error) throw txRes.error
        if (tasksRes.error) throw tasksRes.error
        if (renewalRes.error) throw renewalRes.error

        const txs = txRes.data ?? []
        const allContracts = (allContractsRes.data ?? []) as Contract[]
        const tracks = (tracksRes.error ? [] : (tracksRes.data ?? [])) as MortgageTrack[]

        const rentCatSet = new Set(RENT_CATEGORIES as readonly string[])
        const mortCatSet = new Set(MORTGAGE_CATEGORIES as readonly string[])
        const txIncome = txs.filter(t => t.direction === 'income' && !rentCatSet.has(t.category)).reduce((s, t) => s + t.amount, 0)
        const txExpense = txs.filter(t => t.direction === 'expense' && !mortCatSet.has(t.category)).reduce((s, t) => s + t.amount, 0)

        setTotalIncome(txIncome + rentReceivedToDate(allContracts))
        setTotalExpense(txExpense + mortgagePaidToDate(tracks, todayStr))
        setRecentTransactions(txs.slice(0, 5))
        setOpenTasks(tasksRes.data ?? [])

        const now = Date.now()
        setUpcomingRenewals(
          (renewalRes.data ?? []).map(c => ({
            contract: c,
            daysLeft: Math.ceil((new Date(c.end_date).getTime() - now) / (1000 * 60 * 60 * 24)),
          }))
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, recentTransactions, openTasks, upcomingRenewals, loading, error }
}
