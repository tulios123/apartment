import { parseLocalISO, monthDayISO } from './format'

// Recurrence for a manual task, encoded in the existing `recurrence_days` column
// (a plain integer) so no migration is needed:
//   • positive N  → every N days   (יומי=1, שבועי=7, דו-שבועי=14)
//   • negative N  → every |N| months (חודשי=-1, שנתי=-12)
// A `null`/`0` value means the task does not repeat.

export type RecurrenceOption = { value: number | null; label: string }

// Order matches the picker shown in the "new task" sheet (Google-Tasks style).
export const RECURRENCE_OPTIONS: RecurrenceOption[] = [
  { value: null, label: 'ללא חזרה' },
  { value: 1, label: 'כל יום' },
  { value: 7, label: 'כל שבוע' },
  { value: 14, label: 'כל שבועיים' },
  { value: -1, label: 'כל חודש' },
  { value: -12, label: 'כל שנה' },
]

/** Human label for a stored recurrence value (for chips/badges), or null when it doesn't repeat. */
export function recurrenceLabel(recurrenceDays: number | null | undefined): string | null {
  if (!recurrenceDays) return null
  const known = RECURRENCE_OPTIONS.find(o => o.value === recurrenceDays)
  if (known) return known.label
  // Unknown positive interval — describe it honestly rather than dropping it.
  return recurrenceDays > 0 ? `כל ${recurrenceDays} ימים` : `כל ${-recurrenceDays} חודשים`
}

/**
 * The next due date after `dueISO` for the given recurrence, as a LOCAL `YYYY-MM-DD`
 * string. Day intervals just add days; month intervals advance whole calendar months
 * and clamp to the month's last day (so a task due on the 31st recurs on Feb 28/29,
 * not spilling into March). Returns null when the task doesn't repeat.
 */
export function nextDueDate(dueISO: string | null, recurrenceDays: number | null | undefined): string | null {
  if (!dueISO || !recurrenceDays) return null
  const d = parseLocalISO(dueISO)
  if (recurrenceDays > 0) {
    d.setDate(d.getDate() + recurrenceDays)
    return monthDayISO(d)
  }
  const months = -recurrenceDays
  const targetDay = d.getDate()
  d.setDate(1)                              // avoid JS month-overflow before we set the month
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(targetDay, lastDay))
  return monthDayISO(d)
}
