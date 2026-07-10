import { parseLocalISO, monthDayISO } from './format'

// Repeat options for a manual task — mirrors Google Tasks' "Repeat" list, but only
// the frequencies we can drive today. Stored in the EXISTING tasks.recurrence_days
// integer column (no migration): day-based frequencies store their day count, while
// monthly/yearly use sentinel values interpreted as calendar steps (so a task due on
// the 31st lands on the right day-of-month next month instead of drifting by 30/365
// fixed days). This module is the only writer of these values, so the sentinels are
// unambiguous.
export const MONTHLY = 30
export const YEARLY = 365

export type RepeatOption = { value: number | null; label: string }

export const REPEAT_OPTIONS: RepeatOption[] = [
  { value: null, label: 'לא חוזרת' },
  { value: 1, label: 'כל יום' },
  { value: 7, label: 'כל שבוע' },
  { value: 14, label: 'כל שבועיים' },
  { value: MONTHLY, label: 'כל חודש' },
  { value: YEARLY, label: 'כל שנה' },
]

/** Short label for a stored recurrence interval (null / unknown → "לא חוזרת"). */
export function repeatLabel(days: number | null): string {
  return REPEAT_OPTIONS.find(o => o.value === days)?.label ?? 'לא חוזרת'
}

/**
 * The next occurrence's due date (LOCAL `YYYY-MM-DD`) for a recurring task, given
 * its current due date and stored recurrence interval. Day-based intervals add days;
 * MONTHLY/YEARLY step by calendar month/year and clamp the day-of-month, so e.g.
 * Jan 31 + month → Feb 28/29 (never spilling into March). Uses the local date
 * helpers in lib/format — never a UTC slice — to keep Israel's timezone honest.
 */
export function nextRecurrence(dueISO: string, days: number): string {
  const d = parseLocalISO(dueISO)
  if (days === MONTHLY) return addMonths(d, 1)
  if (days === YEARLY) return addMonths(d, 12)
  d.setDate(d.getDate() + days)
  return monthDayISO(d)
}

function addMonths(d: Date, n: number): string {
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return monthDayISO(target)
}
