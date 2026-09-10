import { useMemo } from 'react'
import { ArrowDown, ArrowUp } from '@phosphor-icons/react'
import { monthlyVirtualEntries } from '../../lib/projections'
import { formatCurrency, parseLocalISO, HEBREW_MONTHS, formatDate } from '../../lib/format'
import { useAuth } from '../../contexts/AuthContext'
import { loadPlan, resolveDates } from '../../lib/purchasePlan'
import type { Contract, MortgageTrack, Loan } from '../../types'

const fmt = (v: number) => formatCurrency(v)

/**
 * תזרים, before the key: one month, and it is the month that frightens people.
 *
 * The owner named this as the third pain — "אתה חושש מכמה יֵרד ברגע שתקבל את הדירה" — and
 * then said what it should be: "המסך תזרים יראה רק את החודש הראשון, והוא ימלא את רוב המסך."
 *
 * He also caught the thing that makes it non-trivial: **the first month is not a normal
 * month.** The mortgage's opening payment usually differs, so one number cannot answer the
 * fear. Both are shown, and the difference between them is the point.
 *
 * The rows come from monthlyVirtualEntries — the same engine the cash-flow screen uses — so
 * this is a second VIEW of the money, never a second calculation of it.
 */
export function FirstMonth({ keyDate, contracts, tracks, loans, policies }: {
  keyDate: string
  contracts: Contract[]
  tracks: MortgageTrack[]
  loans: Loan[]
  policies: { monthly_premium: number | null; start_date: string | null; end_date: string | null }[]
}) {
  const d = parseLocalISO(keyDate)
  const y = d.getFullYear()
  const m = d.getMonth() + 1

  /**
   * What ELSE happens in this month — read off the payment plan, not recomputed.
   *
   * Walked as a buyer (NIGHT_RUN B-2/B-5) this screen answered "how much leaves in the
   * handover month" with the mortgage instalment alone, said the same number four times,
   * and left two thirds of the phone empty — in the month he completes the purchase. These
   * rows are the plan's own, at the plan's own amounts, so the screen gains what actually
   * happens without a second calculation of it anywhere.
   *
   * Deliberately NOT stated here: how much of the balance is his money and how much the
   * bank's. The app currently gives two different answers to that (NIGHT_RUN B-1) and this
   * screen will not pick one before the owner does.
   */
  const { user } = useAuth()
  const monthKey = `${y}-${String(m).padStart(2, '0')}`
  const planRows = useMemo(() => {
    const plan = user ? loadPlan(user.id) : null
    if (!plan) return []
    return resolveDates(plan).filter(i => !i.done && i.due?.startsWith(monthKey))
  }, [user, monthKey])

  const first = useMemo(
    () => monthlyVirtualEntries(contracts, tracks, y, m, loans, policies),
    [contracts, tracks, y, m, loans, policies],
  )
  // The month after — the steady state, which is what "כמה עולה חודש" really asks.
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const steady = useMemo(
    () => monthlyVirtualEntries(contracts, tracks, nextY, nextM, loans, policies),
    [contracts, tracks, nextY, nextM, loans, policies],
  )

  const sum = (rows: typeof first, dir: 'income' | 'expense') =>
    rows.filter(e => e.direction === dir).reduce((s, e) => s + e.amount, 0)

  const out = sum(first, 'expense')
  const income = sum(first, 'income')
  const steadyOut = sum(steady, 'expense')
  const steadyIncome = sum(steady, 'income')
  const differs = Math.abs((steadyOut - steadyIncome) - (out - income)) >= 1

  const expenses = first.filter(e => e.direction === 'expense')
  const incomes = first.filter(e => e.direction === 'income')

  if (first.length === 0) {
    return (
      <div className="fm">
        <div className="fm-head"><h2>{HEBREW_MONTHS[m - 1]} {y}</h2><span>החודש הראשון שלך</span></div>
        <div className="fm-empty">
          כשתהיה משכנתא וביטוח, כאן יופיע בדיוק כמה יֵרד בחודש הראשון — ובמה הוא שונה מחודש רגיל.
        </div>
      </div>
    )
  }

  return (
    <div className="fm">
      <div className="fm-head">
        <h2>{HEBREW_MONTHS[m - 1]} {y}</h2>
        <span>החודש הראשון שלך</span>
      </div>

      <div className="fm-hero">
        <div className="fm-hero-label">יוצא בחודש הראשון</div>
        <div className="fm-hero-value">{fmt(out)}</div>
        {income > 0 && <div className="fm-hero-sub">מזה נכנס {fmt(income)} · נטו {fmt(out - income)}</div>}
      </div>

      <div className="fm-rows">
        {expenses.map(e => (
          <div className="fm-row" key={e.id}>
            <span className="fm-row-name"><ArrowUp size={13} weight="bold" /> {e.category}</span>
            <b>{fmt(e.amount)}</b>
          </div>
        ))}
        {incomes.map(e => (
          <div className="fm-row in" key={e.id}>
            <span className="fm-row-name"><ArrowDown size={13} weight="bold" /> {e.category}</span>
            <b>{fmt(e.amount)}</b>
          </div>
        ))}
      </div>

      {/* The two numbers he asked for. When they are the same, saying so is also useful. */}
      <div className="fm-steady">
        <span>חודש רגיל אחריו</span>
        <b>{fmt(steadyOut)}</b>
      </div>
      <p className="fm-note">
        {differs
          ? 'החודש הראשון שונה מחודש רגיל — בדרך כלל בגלל תשלום המשכנתא הראשון.'
          : 'החודש הראשון זהה לחודש רגיל.'}
      </p>

      {planRows.length > 0 && (
        <section className="fm-plan">
          <h3>גם בחודש הזה, מלוח התשלומים</h3>
          <div className="fm-rows">
            {planRows.map(i => (
              <div className="fm-row" key={i.id}>
                <span className="fm-row-name">
                  {i.label}
                  {i.due && <span className="fm-row-when">{formatDate(i.due)}</span>}
                </span>
                {i.amount > 0 && <b>{fmt(i.amount)}</b>}
              </div>
            ))}
          </div>
          <p className="fm-note">
            אלה שורות לוח התשלומים, לא הוצאה חודשית — הן קורות פעם אחת, בחודש המסירה.
          </p>
        </section>
      )}
    </div>
  )
}
