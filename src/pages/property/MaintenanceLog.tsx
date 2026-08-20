import { useMemo, useState } from 'react'
import { Wrench, Receipt, CaretLeft } from '@phosphor-icons/react'
import { useTransactions } from '../../hooks/useTransactions'
import { supabase } from '../../lib/supabase'
import { redirectToSignedUrl } from '../../lib/storage'
import { formatCurrency, formatDate, todayISO } from '../../lib/format'
import { MAINTENANCE_CATEGORY, PAYMENT_METHODS } from '../../lib/constants'
import { SkeletonList } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
import { DateField } from '../../components/ui/DateField'
import type { Transaction } from '../../types'
import './maintenance-log.css'

const fmt = (v: number) => formatCurrency(v)
const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.filter(p => p.value).map(p => [p.value, p.label]),
)

// What the log counts (owner, 26.07): repairs AND the catch-all "other" — a real repair
// is often filed under אחר. Mortgage / interest / insurance are financing, not upkeep,
// so they stay out. The header breaks the total down by category, which is why the
// Wealth screen's narrower "אחזקה ותיקונים" figure can legitimately differ from it.
const LOG_CATEGORIES = [MAINTENANCE_CATEGORY, 'אחר']

type RangeId = 'year' | 'lastYear' | 'all' | 'custom'

function rangeFor(id: RangeId, customFrom: string, customTo: string): { from?: string; to?: string } {
  const y = new Date().getFullYear()
  if (id === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` }
  if (id === 'lastYear') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
  if (id === 'custom') return { from: customFrom || undefined, to: customTo || undefined }
  return {}
}

export default function MaintenanceLog() {
  const [range, setRange] = useState<RangeId>('year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(todayISO())

  const { from, to } = rangeFor(range, customFrom, customTo)
  const { transactions, loading, error } = useTransactions({ from, to })

  const rows = useMemo(
    () => transactions
      .filter(t => t.direction === 'expense' && LOG_CATEGORIES.includes(t.category))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  )

  // Per-category breakdown — decision ג: show what's inside the total instead of
  // silently mixing repairs with "other", so the number is never a mystery.
  const { total, byCategory } = useMemo(() => {
    const map = new Map<string, number>()
    let sum = 0
    for (const t of rows) {
      const amt = Number(t.amount) || 0
      sum += amt
      map.set(t.category, (map.get(t.category) ?? 0) + amt)
    }
    return { total: sum, byCategory: [...map.entries()].sort((a, b) => b[1] - a[1]) }
  }, [rows])

  async function openReceipt(t: Transaction) {
    if (!t.document_id) return
    const w = window.open('', '_blank')
    const { data } = await supabase.from('documents').select('storage_path').eq('id', t.document_id).single()
    if (!data) { w?.close(); return }
    await redirectToSignedUrl(w, data.storage_path)
  }

  return (
    <div className="mlog">
      {/* Summary — the answer to "what has this apartment cost me to keep up?" */}
      <section className="mlog-summary">
        <div className="mlog-summary-main">
          <span className="mlog-summary-label">סה״כ בתקופה</span>
          <strong className="mlog-summary-value">{fmt(total)}</strong>
        </div>
        <div className="mlog-summary-side">
          <div><span>תיקונים</span><b>{rows.length}</b></div>
          <div><span>ממוצע</span><b>{rows.length ? fmt(total / rows.length) : '—'}</b></div>
        </div>
        {byCategory.length > 1 && (
          <div className="mlog-breakdown">
            {byCategory.map(([cat, amt]) => (
              <span key={cat}><i />{cat} {fmt(amt)}</span>
            ))}
          </div>
        )}
      </section>

      {/* Range picker */}
      <div className="mlog-ranges">
        {([['year', 'השנה'], ['lastYear', 'שנה שעברה'], ['all', 'הכל'], ['custom', 'טווח']] as [RangeId, string][])
          .map(([id, label]) => (
            <button key={id} type="button" className={`mlog-range${range === id ? ' on' : ''}`} onClick={() => setRange(id)}>
              {label}
            </button>
          ))}
      </div>
      {range === 'custom' && (
        <div className="mlog-custom">
          <label><span>מ־</span><DateField value={customFrom} onChange={setCustomFrom} ariaLabel="מתאריך" /></label>
          <label><span>עד</span><DateField value={customTo} onChange={setCustomTo} ariaLabel="עד תאריך" /></label>
        </div>
      )}

      {loading ? <SkeletonList rows={4} />
        : error ? <div className="form-error" role="alert">{error}</div>
        : rows.length === 0 ? (
          <EmptyState
            icon={<ClayIllustration variant="receipt" />}
            title="עוד לא נרשמו תיקונים בתקופה הזו"
            hint="כל הוצאה שתרשמו בקטגוריית תיקונים תופיע כאן, יחד עם הקבלה."
          />
        ) : (
          <div className="mlog-rows">
            {rows.map(t => (
              <div key={t.id} className="mlog-row">
                <span className="mlog-row-icon"><Wrench size={18} weight="duotone" /></span>
                <div className="mlog-row-body">
                  <div className="mlog-row-top">
                    <span className="mlog-row-title">{t.description?.trim() || t.category}</span>
                    <span className="mlog-row-amount">−{fmt(Number(t.amount) || 0)}</span>
                  </div>
                  <div className="mlog-row-meta">
                    <span>{formatDate(t.date)}</span>
                    <span className="mlog-row-cat">{t.category}</span>
                    {t.payment_method && <span>{PAYMENT_LABEL[t.payment_method] ?? t.payment_method}</span>}
                    {t.document_id && (
                      <button type="button" className="mlog-receipt" onClick={() => openReceipt(t)}>
                        <Receipt size={13} weight="bold" /> קבלה <CaretLeft size={11} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
