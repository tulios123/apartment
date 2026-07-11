import { daysBetween } from './format'
import { TASK_HOME_LEAD_DAYS } from './constants'
import type { Task } from '../types'

/**
 * Which tasks surface on the home action list, in display order.
 *
 * A task scheduled for a specific future date stays hidden until it's within the
 * lead window (`TASK_HOME_LEAD_DAYS` days out) or already overdue — a date far
 * ahead shouldn't clutter "what to do now". Undated backlog tasks always show so
 * nothing deadline-less gets forgotten.
 *
 * Sorted dated-first (soonest/overdue on top), then undated backlog.
 */
export function visibleHomeTasks(tasks: Task[], today: string): Task[] {
  return tasks
    .filter(t => !t.due_date || daysBetween(today, t.due_date) <= TASK_HOME_LEAD_DAYS)
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })
}
