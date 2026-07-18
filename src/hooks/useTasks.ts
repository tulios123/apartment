import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { createGoogleTask, updateGoogleTask, deleteGoogleTask, GOOGLE_TASKS_ENABLED } from '../lib/googleTasks'
import { syncGoogleTasks } from './useGoogleTasksSync'
import { readCache, writeCache } from '../lib/queryCache'
import { nextDueDate } from '../lib/recurrence'
import type { Task } from '../types'
import { latestOnly } from '../lib/latestOnly'

interface Filters {
  status?: 'open' | 'done' | 'all'
}

export function useTasks(filters: Filters = {}) {
  const { user } = useAuth()
  const cacheKey = user ? `tasks:${user.id}:${filters.status ?? 'open'}` : null
  const [tasks, setTasks] = useState<Task[]>(() => readCache<Task[]>(cacheKey) ?? [])
  const [loading, setLoading] = useState(() => readCache<Task[]>(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  // SW-12: only the LATEST fetch (effect or manual refetch) may commit state.
  const guard = useRef(latestOnly())

  const fetch = useCallback(async () => {
    if (!user) return
    const fresh = guard.current.start()
    const cached = readCache<Task[]>(cacheKey)
    if (cached) setTasks(cached)
    setLoading(cached == null)
    setError(null)

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('owner_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (!filters.status || filters.status === 'open') {
      query = query.eq('status', 'open')
    } else if (filters.status === 'done') {
      query = query.eq('status', 'done')
    }

    const { data, error } = await query
    if (!fresh()) return   // superseded by a newer fetch (or unmounted) — don't overwrite
    if (error) setError(error.message)
    else { setTasks(data ?? []); writeCache<Task[]>(cacheKey, data ?? []) }
    setLoading(false)
  }, [user?.id, cacheKey, filters.status])

  useEffect(() => {
    if (!user || !GOOGLE_TASKS_ENABLED) return
    syncGoogleTasks(user.id).then(result => {
      setSyncError(result.error)
      fetch()
    })
  }, [user?.id])

  useEffect(() => { fetch(); return () => guard.current.invalidate() }, [fetch])

  return { tasks, setTasks, loading, error, syncError, refetch: fetch }
}

async function getOwnerId(): Promise<string> {
  // Read from the cached session (local) rather than getUser() — the latter
  // makes a network round trip to validate the token, which needlessly slows
  // down every write (e.g. ticking a task complete).
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not authenticated')
  return session.user.id
}

export async function createTask(data: Omit<Task, 'id' | 'owner_id' | 'created_at' | 'google_task_id' | 'completed_at'>) {
  const ownerId = await getOwnerId()

  // due_time is only sent when actually set, so the column stays additive: core
  // task creation keeps working even if migration 030 hasn't been applied yet.
  const { due_time, ...rest } = data
  const insert = { ...rest, owner_id: ownerId, ...(due_time != null ? { due_time } : {}) }

  const { data: created, error } = await supabase
    .from('tasks')
    .insert(insert)
    .select()
    .single()

  if (error || !created) return { data: created, error }

  if (GOOGLE_TASKS_ENABLED) {
    try {
      const gt = await createGoogleTask(data.title, data.due_date ?? null)
      await supabase.from('tasks').update({ google_task_id: gt.id }).eq('id', created.id)
    } catch {
      // Google sync failed — not critical
    }
  }

  return { data: created, error: null }
}

/**
 * When a recurring task is completed, open its next occurrence (advance the due
 * date by the recurrence interval). Mirrors Google Tasks: ticking a repeating task
 * done spawns the next one. No-op for non-recurring tasks or those without a date.
 * Returns the created row (or null) so callers can decide whether to refetch.
 */
export async function spawnNextOccurrence(task: Task) {
  if (!task.is_recurring || !task.recurrence_days) return null
  const next = nextDueDate(task.due_date, task.recurrence_days)
  if (!next) return null
  const { data } = await createTask({
    property_id: task.property_id, recurring_item_id: task.recurring_item_id, transaction_id: null,
    title: task.title, due_date: next, due_time: task.due_time,
    category: task.category, status: 'open', source: task.source,
    is_recurring: true, recurrence_days: task.recurrence_days,
  })
  return data
}

export async function updateTask(
  id: string,
  data: Partial<Omit<Task, 'id' | 'owner_id' | 'created_at'>>
) {
  const ownerId = await getOwnerId()

  // Drop a null due_time from the update so an edit that doesn't set a time never
  // touches the column (keeps it additive until migration 030 is applied).
  const cleaned = data.due_time == null ? (() => { const { due_time, ...r } = data; return r })() : data

  // Stamp/clear the completion time alongside any status change (powers the logbook).
  const payload = cleaned.status !== undefined
    ? { ...cleaned, completed_at: cleaned.status === 'done' ? new Date().toISOString() : null }
    : cleaned

  // The write itself is the only thing the UI waits on. Mirroring to Google
  // Tasks (which needs its own lookup round trip) runs in the background so a
  // simple status toggle doesn't stall on extra network calls.
  const result = await supabase.from('tasks').update(payload).eq('id', id).eq('owner_id', ownerId)

  if (GOOGLE_TASKS_ENABLED) void mirrorToGoogleTasks(id, data)

  return result
}

async function mirrorToGoogleTasks(
  id: string,
  data: Partial<Omit<Task, 'id' | 'owner_id' | 'created_at'>>
) {
  if (data.title === undefined && data.due_date === undefined && data.status === undefined) return
  try {
    const { data: current } = await supabase
      .from('tasks')
      .select('google_task_id')
      .eq('id', id)
      .single()
    if (!current?.google_task_id) return
    await updateGoogleTask(current.google_task_id, {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.due_date !== undefined
        ? { due: data.due_date ? `${data.due_date}T00:00:00.000Z` : null }
        : {}),
      ...(data.status !== undefined
        ? { status: data.status === 'done' ? 'completed' : 'needsAction' }
        : {}),
    })
  } catch {
    // Google sync failed — not critical
  }
}

export async function deleteTask(id: string) {
  const ownerId = await getOwnerId()

  const { data: current } = await supabase
    .from('tasks')
    .select('google_task_id')
    .eq('id', id)
    .single()

  const result = await supabase.from('tasks').delete().eq('id', id).eq('owner_id', ownerId)

  if (GOOGLE_TASKS_ENABLED && current?.google_task_id) {
    try {
      await deleteGoogleTask(current.google_task_id)
    } catch {
      // Google sync failed — not critical
    }
  }

  return result
}
