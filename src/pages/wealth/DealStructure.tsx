import { formatCurrency } from '../../lib/format'
import type { MortgageTrack, Loan, InvestmentCost } from '../../types'
import { INVESTMENT_COST_CATEGORIES } from '../../lib/constants'

const fmt = (v: number) => formatCurrency(v)

/**
 * מבנה העסקה — what the deal is made of.
 *
 * The owner asked for this by name (09.09: "בהון נעשה את מבנה המימון המלא וכל מבנה העסקה
 * הסופי"), and the screen did not have it: it jumped straight to judgement — equity, yields,
 * the accelerator — without ever showing the composition those judgements rest on.
 *
 * It is also the one block on this screen that is true in every stage. Judgement expires and
 * changes every month; how you put the deal together does not.
 */
export function DealStructure({ price, tracks, loans, costs, fromPocket }: {
  price: number
  tracks: MortgageTrack[]
  loans: Loan[]
  costs: InvestmentCost[]
  /** From the payment plan when one exists — otherwise derived from what is stored. */
  fromPocket?: number
}) {
  const mortgage = tracks.reduce((s, t) => s + (Number(t.principal) || 0), 0)
  const otherLoans = loans.reduce((s, l) => s + (Number(l.principal) || 0), 0)
  const equity = Math.max(0, price - mortgage)

  const named = costs
    .filter(c => c.category !== 'self_equity' && Number(c.amount) > 0)
    .map(c => ({
      label: INVESTMENT_COST_CATEGORIES.find(x => x.value === c.category)?.label ?? c.label ?? 'עלות',
      amount: Number(c.amount),
    }))
  const costsTotal = named.reduce((s, c) => s + c.amount, 0)
  const pocket = fromPocket ?? equity + costsTotal

  if (!(price > 0)) return null

  return (
    <section className="wlth-card wlth-deal">
      <div className="wlth-card-head">
        <h2>מבנה העסקה</h2>
        <span className="wlth-card-note">לא מתיישן</span>
      </div>

      <div className="wlth-deal-rows">
        <div className="wlth-deal-row"><span>מחיר הדירה</span><b>{fmt(price)}</b></div>
        {mortgage > 0 && (
          <div className="wlth-deal-row">
            <span>משכנתא{price > 0 ? ` · ${Math.round(mortgage / price * 100)}%` : ''}</span>
            <b>{fmt(mortgage)}</b>
          </div>
        )}
        {otherLoans > 0 && <div className="wlth-deal-row"><span>הלוואות נוספות</span><b>{fmt(otherLoans)}</b></div>}
        <div className="wlth-deal-row">
          <span>הון עצמי{price > 0 ? ` · ${Math.round(equity / price * 100)}%` : ''}</span>
          <b>{fmt(equity)}</b>
        </div>
      </div>

      {named.length > 0 && (
        <>
          <div className="wlth-deal-sub">הוצאות נלוות · {fmt(costsTotal)}</div>
          <div className="wlth-deal-rows">
            {named.map(c => (
              <div className="wlth-deal-row minor" key={c.label}><span>{c.label}</span><b>{fmt(c.amount)}</b></div>
            ))}
          </div>
        </>
      )}

      <div className="wlth-deal-row total"><span>סה״כ מהכיס</span><b>{fmt(pocket)}</b></div>
      {costsTotal > 0 && (
        <p className="wlth-deal-note">
          {fmt(costsTotal)} מההוצאות לא הופכות להון — הן מחיר הכניסה.
        </p>
      )}
    </section>
  )
}
