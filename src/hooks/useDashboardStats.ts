import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Transaction, Task } from '../types'

export interface DashboardStats {
  totalIncome: number
  totalExpense: number
  balance: number
  recentTransactions: Transaction[]
  openTasks: Task[]
  loading: boolean
  error: string | null
}

export function useDashboardStats(): DashboardStats {
  const { user } = useAuth()
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [openTasks, setOpenTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [txRes, tasksRes] = await Promise.all([
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
        ])

        if (txRes.error) throw txRes.error
        if (tasksRes.error) throw tasksRes.error

        const txs = txRes.data ?? []
        setTotalIncome(txs.filter(t => t.direction === 'income').reduce((s, t) => s + t.amount, 0))
        setTotalExpense(txs.filter(t => t.direction === 'expense').reduce((s, t) => s + t.amount, 0))
        setRecentTransactions(txs.slice(0, 5))
        setOpenTasks(tasksRes.data ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, recentTransactions, openTasks, loading, error }
}
