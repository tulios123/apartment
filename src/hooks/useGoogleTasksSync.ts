import { supabase } from '../lib/supabase'
import { listGoogleTasks, createGoogleTask } from '../lib/googleTasks'

function toOurStatus(googleStatus: string): 'open' | 'done' {
  return googleStatus === 'completed' ? 'done' : 'open'
}

function parseGoogleDue(due?: string): string | null {
  if (!due) return null
  return due.slice(0, 10)
}

export async function syncGoogleTasks(ownerId: string): Promise<{ error: string | null }> {
  let googleTasks: Awaited<ReturnType<typeof listGoogleTasks>>
  try {
    googleTasks = await listGoogleTasks()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Google sync failed' }
  }

  const { data: ourTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, status, google_task_id, source, recurring_item_id')
    .eq('owner_id', ownerId)

  if (!ourTasks) return { error: null }

  const apartmentIds = new Set(googleTasks.map(t => t.id))
  const ourByGoogleId = new Map(
    ourTasks.filter(t => t.google_task_id).map(t => [t.google_task_id as string, t])
  )
  const ourWithoutGoogleId = ourTasks.filter(t => !t.google_task_id)

  // Remove tasks that were synced from a different Google list (stale google_task_id)
  const stale = ourTasks.filter(
    t => t.google_task_id && !apartmentIds.has(t.google_task_id) && t.source === 'manual' && !t.recurring_item_id
  )
  if (stale.length > 0) {
    await supabase.from('tasks').delete().in('id', stale.map(t => t.id))
  }

  // Google → our DB
  const toInsert: object[] = []
  const toUpdate: { id: string; changes: object }[] = []

  for (const gt of googleTasks) {
    const existing = ourByGoogleId.get(gt.id)
    if (existing) {
      const newStatus = toOurStatus(gt.status)
      const newDue = parseGoogleDue(gt.due)
      if (existing.title !== gt.title || existing.status !== newStatus || existing.due_date !== newDue) {
        toUpdate.push({ id: existing.id, changes: { title: gt.title, status: newStatus, due_date: newDue } })
      }
    } else {
      toInsert.push({
        owner_id: ownerId,
        google_task_id: gt.id,
        title: gt.title,
        due_date: parseGoogleDue(gt.due),
        status: toOurStatus(gt.status),
        category: 'כללי',
        source: 'manual',
        is_recurring: false,
        recurrence_days: null,
        property_id: null,
        recurring_item_id: null,
        transaction_id: null,
      })
    }
  }

  if (toInsert.length > 0) await supabase.from('tasks').insert(toInsert)
  for (const { id, changes } of toUpdate) {
    await supabase.from('tasks').update(changes).eq('id', id)
  }

  // Our tasks → Google (push tasks that were never synced)
  for (const task of ourWithoutGoogleId) {
    try {
      const gt = await createGoogleTask(task.title, task.due_date)
      await supabase.from('tasks').update({ google_task_id: gt.id }).eq('id', task.id)
    } catch {
      // Skip silently — individual push failures don't block the rest
    }
  }

  return { error: null }
}
