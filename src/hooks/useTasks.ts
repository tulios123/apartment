import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { createGoogleTask, updateGoogleTask, deleteGoogleTask } from '../lib/googleTasks'
import { syncGoogleTasks } from './useGoogleTasksSync'
import type { Task } from '../types'

interface Filters {
  status?: 'open' | 'done' | 'all'
}

export function useTasks(filters: Filters = {}) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
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
    if (error) setError(error.message)
    else setTasks(data ?? [])
    setLoading(false)
  }, [user?.id, filters.status])

  useEffect(() => {
    if (!user) return
    syncGoogleTasks(user.id).then(result => {
      setSyncError(result.error)
      fetch()
    })
  }, [user?.id])

  useEffect(() => { fetch() }, [fetch])

  return { tasks, setTasks, loading, error, syncError, refetch: fetch }
}

async function getOwnerId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export async function createTask(data: Omit<Task, 'id' | 'owner_id' | 'created_at' | 'google_task_id' | 'completed_at'>) {
  const ownerId = await getOwnerId()

  const { data: created, error } = await supabase
    .from('tasks')
    .insert({ ...data, owner_id: ownerId })
    .select()
    .single()

  if (error || !created) return { data: created, error }

  try {
    const gt = await createGoogleTask(data.title, data.due_date ?? null)
    await supabase.from('tasks').update({ google_task_id: gt.id }).eq('id', created.id)
  } catch {
    // Google sync failed — not critical
  }

  return { data: created, error: null }
}

export async function updateTask(
  id: string,
  data: Partial<Omit<Task, 'id' | 'owner_id' | 'created_at'>>
) {
  const ownerId = await getOwnerId()

  const { data: current } = await supabase
    .from('tasks')
    .select('google_task_id')
    .eq('id', id)
    .single()

  // Stamp/clear the completion time alongside any status change (powers the logbook).
  const payload = data.status !== undefined
    ? { ...data, completed_at: data.status === 'done' ? new Date().toISOString() : null }
    : data

  const result = await supabase.from('tasks').update(payload).eq('id', id).eq('owner_id', ownerId)

  if (current?.google_task_id) {
    try {
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

  return result
}

export async function deleteTask(id: string) {
  const ownerId = await getOwnerId()

  const { data: current } = await supabase
    .from('tasks')
    .select('google_task_id')
    .eq('id', id)
    .single()

  const result = await supabase.from('tasks').delete().eq('id', id).eq('owner_id', ownerId)

  if (current?.google_task_id) {
    try {
      await deleteGoogleTask(current.google_task_id)
    } catch {
      // Google sync failed — not critical
    }
  }

  return result
}
