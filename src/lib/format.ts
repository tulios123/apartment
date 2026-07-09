export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

/**
 * Currency with an explicit +/− sign, correctly placed for Hebrew RTL.
 * Intl's `signDisplay` keeps the sign glued to the number (it inserts an LRM so
 * "+362" stays a unit) and the ₪ properly separated — avoiding the broken layout
 * of `'+' + formatCurrency(x)`, where a bare sign sits outside the currency's RTL
 * run and drifts away from the digits. No sign for zero.
 */
export function formatSignedCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(amount)
}

export function formatDate(date: string | null): string {
  if (!date) return ''
  // EDGE-04: `new Date('YYYY-MM-DD')` parses as UTC midnight, so a viewer behind UTC
  // would render every stored date one day early. Build a LOCAL date from the parts
  // (date columns are date-only) so the displayed day matches what was stored.
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('he-IL')
}

/** Parse a stored `YYYY-MM-DD` as LOCAL midnight (not UTC) — matches mortgage.ts/loans.ts. */
export function parseLocalISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

/**
 * Whole-day difference between two `YYYY-MM-DD` strings, both anchored at UTC
 * midnight so there is no hour drift. Positive when `toISO` is after `fromISO`.
 * Mirrors the daily-reminders edge function so client and server agree on "days left"
 * (EDGE-01/02) rather than diverging by a day near local midnight.
 */
export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = toISO.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
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

// Editing a big comma-grouped number (e.g. fixing a digit in the middle of
// "2,500,000") is uncomfortable if the caret always jumps to the end after
// each keystroke — the default when a controlled input is reformatted on
// every change. Given the formatted string and how many digits preceded the
// caret before re-grouping, this returns where the caret belongs now (right
// after the same digit).
export function caretIndexAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++
      if (seen === digitCount) return i + 1
    }
  }
  return formatted.length
}
