import { daysBetween } from './format'
import { TASK_HOME_LEAD_DAYS } from './constants'
import type { Task } from '../types'

/**
 * All open tasks in home display order: dated first (soonest/overdue on top),
 * then undated backlog. This is the full list revealed when "+ עוד X משימות"
 * is expanded — nothing is hidden here, regardless of date.
 */
export function sortedHomeTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })
}

/**
 * Which tasks surface on the *collapsed* home action list, in display order.
 *
 * A task scheduled for a specific future date stays hidden until it's within the
 * lead window (`TASK_HOME_LEAD_DAYS` days out) or already overdue — a date far
 * ahead shouldn't clutter "what to do now". Undated backlog tasks always show so
 * nothing deadline-less gets forgotten. Expanding the "+ עוד X משימות" pill still
 * reveals the held-back future ones (see `sortedHomeTasks`).
 */
export function visibleHomeTasks(tasks: Task[], today: string): Task[] {
  return sortedHomeTasks(
    tasks.filter(t => !t.due_date || daysBetween(today, t.due_date) <= TASK_HOME_LEAD_DAYS),
  )
}

/**
 * The soonest future-dated task held back from the collapsed home (beyond the lead
 * window), or null if none. Used to name it concretely on the home — "משימה מתוזמנת
 * ל-<date>" — so a task the owner scheduled for a specific day is recognisably theirs
 * instead of a vague "scheduled task" they don't connect to (owner: "I don't see it").
 */
export function nextScheduledTask(tasks: Task[], today: string): Task | null {
  const held = sortedHomeTasks(
    tasks.filter(t => t.due_date && daysBetween(today, t.due_date) > TASK_HOME_LEAD_DAYS),
  )
  return held[0] ?? null
}
