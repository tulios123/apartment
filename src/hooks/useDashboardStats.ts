import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { rentReceivedToDate, mortgagePaidToDate } from '../lib/projections'
import { readCache, writeCache } from '../lib/queryCache'
import { todayISO, monthDayISO, daysBetween } from '../lib/format'
import { RENT_CATEGORIES, MORTGAGE_CATEGORIES } from '../lib/constants'
import type { Transaction, Task, Contract, MortgageTrack } from '../types'
import { latestOnly } from '../lib/latestOnly'

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
  /** A secondary query (contracts/tracks) failed — totals may be partial (C7-B). */
  partial: boolean
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
  const [partial, setPartial] = useState(false)
  // SW-12: only the LATEST load may commit state (fast nav / unmount race).
  const guard = useRef(latestOnly())

  useEffect(() => {
    if (!user) return

    async function load() {
      const fresh = guard.current.start()
      // Already showing cached numbers? Refresh silently. First-ever load shows the skeleton.
      setLoading(readCache<StatsSnapshot>(cacheKey) == null)
      setError(null)
      setPartial(false)
      try {
        const todayStr = todayISO() // LOCAL date — not toISOString (UTC rolls back a day)
        const in90 = new Date(); in90.setDate(in90.getDate() + 90)
        const in90Str = monthDayISO(in90)

        const [txRes, tasksRes, renewalRes, allContractsRes, tracksRes, mortgageRes] = await Promise.all([
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
          supabase.from('mortgages').select('payment_day').eq('owner_id', user!.id).limit(1),
        ])

        if (txRes.error) throw txRes.error
        if (tasksRes.error) throw tasksRes.error
        if (renewalRes.error) throw renewalRes.error

        // EDGE-23/14: coerce amounts to finite numbers at the boundary so a bad row
        // can't poison the all-time totals.
        const txs = (txRes.data ?? []).map(t => ({ ...t, amount: Number(t.amount) || 0 }))
        const allContracts = (allContractsRes.data ?? []) as Contract[]
        // Stamp the mortgage's single billing day onto each track (see useMortgageData),
        // so the schedule dates match the ledger's mortgage forecast.
        const mortPayDay = (mortgageRes.error ? null : (mortgageRes.data?.[0]?.payment_day ?? null))
        const tracks = ((tracksRes.error ? [] : (tracksRes.data ?? [])) as MortgageTrack[])
          .map(t => ({ ...t, payment_day: mortPayDay }))
        // C7-B: surface (don't silently swallow) a secondary-query failure — rather
        // than computing rent/mortgage totals on empty arrays and showing ₪0 as if real.
        if (!fresh()) return   // superseded by a newer load (or unmounted) — don't overwrite
        if (allContractsRes.error || tracksRes.error) setPartial(true)

        const rentCatSet = new Set(RENT_CATEGORIES as readonly string[])
        const mortCatSet = new Set(MORTGAGE_CATEGORIES as readonly string[])
        const txIncome = txs.filter(t => t.direction === 'income' && !rentCatSet.has(t.category)).reduce((s, t) => s + t.amount, 0)
        const txExpense = txs.filter(t => t.direction === 'expense' && !mortCatSet.has(t.category)).reduce((s, t) => s + t.amount, 0)

        const nextIncome = txIncome + rentReceivedToDate(allContracts)
        const nextExpense = txExpense + mortgagePaidToDate(tracks, todayStr)
        const nextRecent = txs.slice(0, 5)
        const nextTasks = tasksRes.data ?? []
        // EDGE-02: whole-day string diff (matches the edge function / monthly generation)
        // instead of mixing a UTC-midnight Date with an absolute `now`.
        const nextRenewals = (renewalRes.data ?? []).map(c => ({
          contract: c,
          daysLeft: daysBetween(todayStr, c.end_date),
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
        if (fresh()) setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים')
      } finally {
        if (fresh()) setLoading(false)
      }
    }

    load()
    return () => guard.current.invalidate()
  }, [user, cacheKey])

  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, recentTransactions, openTasks, upcomingRenewals, loading, error, partial }
}
