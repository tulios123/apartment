export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('he-IL')
}

// Format a raw numeric string for display in a text input (adds thousand-commas).
// Store the clean string in state; use this only as the input's value prop.
export function formatNum(raw: string | number): string {
  const str = String(raw)
  if (str === '') return ''
  const n = Number(str)
  if (isNaN(n)) return str
  return n.toLocaleString('en-US')
}
