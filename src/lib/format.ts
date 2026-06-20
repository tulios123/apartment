export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('he-IL')
}

/** Today as a LOCAL `YYYY-MM-DD` string (avoids the UTC roll-back of toISOString). */
export function todayISO(): string {
  return monthDayISO(new Date())
}

/** A Date as a LOCAL `YYYY-MM-DD` string. */
export function monthDayISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Last calendar day of a month as a LOCAL `YYYY-MM-DD` string (month is 1-12).
 * Avoids the UTC roll-back that `new Date(y, m, 0).toISOString().slice(0,10)`
 * causes in timezones ahead of UTC (e.g. Israel), which returned the
 * second-to-last day and silently dropped last-of-month rows from queries.
 */
export function monthEndISO(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

// Format a raw numeric string for display in a text input (adds thousand-commas).
// Store the clean string in state; use this only as the input's value prop.
export function formatNum(raw: string | number): string {
  const str = String(raw)
  if (str === '') return ''
  const n = Number(str)
  if (isNaN(n)) return str
  return n.toLocaleString('he-IL')
}
