import { TrendUp } from '@phosphor-icons/react'
import { formatCurrency } from '../../lib/format'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  /** This month's rent (active contract). */
  monthlyRent: number
  /** Interest portion of the mortgage payment this month — a true cost. */
  mortgageInterest: number
  /** Interest portion of any supplementary loans this month — also a true cost. */
  loansInterest: number
  /** Principal portion — money that returns to you as equity, not a loss. */
  monthlyPrincipal: number
  /** Estimated average monthly maintenance (trailing), 0 if unknown. */
  monthlyMaintenance: number
}

/**
 * "What you REALLY earn this month." The naive view (rent − full mortgage
 * payment) counts principal as a loss — but principal is forced savings that
 * builds equity. So the honest monthly result is rent − interest − upkeep, and
 * the principal is surfaced separately as money that came back to you.
 */
export default function MonthlyResult({ monthlyRent, mortgageInterest, loansInterest, monthlyPrincipal, monthlyMaintenance }: Props) {
  const monthlyInterest = mortgageInterest + loansInterest
  if (monthlyRent <= 0 && monthlyInterest <= 0) return null

  const realProfit = monthlyRent - monthlyInterest - monthlyMaintenance
  const cashFlow = monthlyRent - monthlyInterest - monthlyPrincipal - monthlyMaintenance

  return (
    <section className="wlth-card wlth-result">
      <div className="wlth-card-head">
        <TrendUp size={18} weight="duotone" color="var(--brand-navy)" />
        <h2>הרווח החודשי האמיתי</h2>
        <span className="wlth-card-note">קרן = חיסכון, לא הוצאה</span>
      </div>

      <div className="wlth-result-rows">
        <div className="wlth-result-row">
          <span><i className="wlth-cf-dot in" /> שכר דירה</span>
          <strong className="in">+{fmt(monthlyRent)}</strong>
        </div>
        {mortgageInterest > 0 && (
          <div className="wlth-result-row">
            <span><i className="wlth-cf-dot out" /> ריבית המשכנתא</span>
            <strong className="out">−{fmt(mortgageInterest)}</strong>
          </div>
        )}
        {loansInterest > 0 && (
          <div className="wlth-result-row">
            <span><i className="wlth-cf-dot out" /> ריבית ההלוואות</span>
            <strong className="out">−{fmt(loansInterest)}</strong>
          </div>
        )}
        {monthlyMaintenance > 0 && (
          <div className="wlth-result-row">
            <span><i className="wlth-cf-dot out" /> אחזקה (ממוצע חודשי)</span>
            <strong className="out">−{fmt(monthlyMaintenance)}</strong>
          </div>
        )}
      </div>

      <div className="wlth-result-net">
        <span>רווח אמיתי בחודש</span>
        <strong className={realProfit >= 0 ? 'in' : 'out'}>{realProfit >= 0 ? '+' : '−'}{fmt(Math.abs(realProfit))}</strong>
      </div>

      {monthlyPrincipal > 0 && (
        <p className="wlth-result-note">
          בנוסף, <b>{fmt(monthlyPrincipal)}</b> מהתשלום חוזרים אליך כהון (קרן) — מקטינים את החוב, לא הפסד.
          {cashFlow < 0 && <> בתזרים-המזומן יוצאים {fmt(Math.abs(cashFlow))}, אבל הם נשמרים כבעלות.</>}
        </p>
      )}
    </section>
  )
}
