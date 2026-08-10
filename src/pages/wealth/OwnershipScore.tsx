import { TrendUp } from '@phosphor-icons/react'
import { formatCurrency, formatSignedCurrency } from '../../lib/format'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  propertyValue: number
  /** Outstanding bank debt: mortgage + monthly_fixed loans. */
  bankDebt: number
  /** Outstanding family/balloon financing (interest-free, settled on sale). */
  balloon: number
  /** This month's principal portion — money converted into ownership. */
  monthlyPrincipal: number
}

/**
 * Layer 1 — the Ownership Score. Leads with Net Equity (net of the balloon) and
 * an ownership % framed as progress, with a three-tier ladder splitting the
 * property value into yours / banks / family.
 */
export default function OwnershipScore({ propertyValue, bankDebt, balloon, monthlyPrincipal }: Props) {
  const netEquity = propertyValue - bankDebt - balloon
  const pct = (v: number) => (propertyValue > 0 ? Math.max(0, (v / propertyValue) * 100) : 0)
  const ownPct = pct(netEquity)

  return (
    <section className="wlth-hero">
      <div className="wlth-hero-top">
        <div>
          <div className="wlth-hero-label">הון עצמי נטו</div>
          <div className="wlth-hero-value">{fmt(netEquity)}</div>
          <div className="wlth-hero-sub">מתוך שווי נכס של {fmt(propertyValue)}</div>
        </div>
        {monthlyPrincipal > 0 && (
          <div className="wlth-delta" title="הקרן שתיפרע החודש מצטרפת להון העצמי שלך">
            <TrendUp size={15} weight="bold" />
            <span>{formatSignedCurrency(monthlyPrincipal)} לבעלות החודש</span>
          </div>
        )}
      </div>

      <div className="wlth-own-pct">בבעלותך {ownPct.toFixed(0)}% מהנכס</div>

      <div className="wlth-ladder" aria-hidden="true">
        {netEquity > 0 && <div className="seg yours" style={{ width: `${pct(netEquity)}%` }} />}
        {balloon > 0 && <div className="seg family" style={{ width: `${pct(balloon)}%` }} />}
        {bankDebt > 0 && <div className="seg banks" style={{ width: `${pct(bankDebt)}%` }} />}
      </div>

      {/* The "yours" legend is a label-only key for the green segment — its amount is
          the hero headline just above, so repeating the number here was pure duplication
          (owner, 20.07: declutter the hero, drop the repeated equity figure). Family/banks
          keep their amounts (the breakdown isn't stated in the headline). */}
      <div className="wlth-ladder-legend">
        <span><i className="dot yours" /> בבעלותך</span>
        {balloon > 0 && <span><i className="dot family" /> מימון משפחה <b>{fmt(balloon)}</b></span>}
        {bankDebt > 0 && <span><i className="dot banks" /> נותר לבעלות · בנקים <b>{fmt(bankDebt)}</b></span>}
      </div>
    </section>
  )
}
