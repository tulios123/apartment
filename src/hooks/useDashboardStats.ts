import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { rentReceivedToDate, mortgagePaidToDate } from '../lib/projections'
import { readCache, writeCache } from '../lib/queryCache'
import { todayISO, monthDayISO } from '../lib/format'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../lib/constants'
import type { Transaction, Task, Contract, MortgageTrack } from '../types'

type StatsSnapshot = {
  totalIncome: number
  totalExpense: number
  recentTransactions: Transaction[]
  openTasks: Task[]
  upcomingRenewals: UpcomingRenewal[]
}

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
  const cacheKey = user ? `dashboard:${user.id}` : null
  const cached0 = readCache<StatsSnapshot>(cacheKey)
  const [totalIncome, setTotalIncome] = useState(() => readCache<StatsSnapshot>(cacheKey)?.totalIncome ?? 0)
  const [totalExpense, setTotalExpense] = useState(() => readCache<StatsSnapshot>(cacheKey)?.totalExpense ?? 0)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(() => readCache<StatsSnapshot>(cacheKey)?.recentTransactions ?? [])
  const [openTasks, setOpenTasks] = useState<Task[]>(() => readCache<StatsSnapshot>(cacheKey)?.openTasks ?? [])
  const [upcomingRenewals, setUpcomingRenewals] = useState<UpcomingRenewal[]>(() => readCache<StatsSnapshot>(cacheKey)?.upcomingRenewals ?? [])
  const [loading, setLoading] = useState(cached0 == null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      // Already showing cached numbers? Refresh silently. First-ever load shows the skeleton.
      setLoading(readCache<StatsSnapshot>(cacheKey) == null)
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

        const nextIncome = txIncome + rentReceivedToDate(allContracts)
        const nextExpense = txExpense + mortgagePaidToDate(tracks, todayStr)
        const nextRecent = txs.slice(0, 5)
        const nextTasks = tasksRes.data ?? []
        const now = Date.now()
        const nextRenewals = (renewalRes.data ?? []).map(c => ({
          contract: c,
          daysLeft: Math.ceil((new Date(c.end_date).getTime() - now) / (1000 * 60 * 60 * 24)),
        }))

        setTotalIncome(nextIncome)
        setTotalExpense(nextExpense)
        setRecentTransactions(nextRecent)
        setOpenTasks(nextTasks)
        setUpcomingRenewals(nextRenewals)
        writeCache<StatsSnapshot>(cacheKey, {
          totalIncome: nextIncome, totalExpense: nextExpense,
          recentTransactions: nextRecent, openTasks: nextTasks, upcomingRenewals: nextRenewals,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user, cacheKey])

  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, recentTransactions, openTasks, upcomingRenewals, loading, error }
}
