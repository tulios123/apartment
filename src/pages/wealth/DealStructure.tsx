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
export function DealStructure({ price, tracks, loans, costs, tax }: {
  price: number
  tracks: MortgageTrack[]
  loans: Loan[]
  costs: InvestmentCost[]
  /**
   * Purchase tax, from the payment plan when one exists. It is his money and it is often
   * the largest cost after the equity, so when it is NOT known the card says so rather
   * than quietly totalling without it.
   */
  tax?: number
}) {
  const mortgage = tracks.reduce((s, t) => s + (Number(t.principal) || 0), 0)
  const otherLoans = loans.reduce((s, l) => s + (Number(l.principal) || 0), 0)
  const equity = Math.max(0, price - mortgage - otherLoans)

  const named = costs
    .filter(c => c.category !== 'self_equity' && Number(c.amount) > 0)
    .map(c => ({
      label: INVESTMENT_COST_CATEGORIES.find(x => x.value === c.category)?.label ?? c.label ?? 'עלות',
      amount: Number(c.amount),
    }))
  // Since 21.09 the wizard asks for purchase tax as a cost of its own, so most accounts
  // now carry a real row for it. The plan's figure is the fallback for accounts that
  // predate that — never an addition to it, or the card would count the tax twice.
  const hasTaxRow = costs.some(c => c.category === 'purchase_tax' && Number(c.amount) > 0)
  if (!hasTaxRow && tax != null && tax > 0) named.push({ label: 'מס רכישה', amount: tax })
  const taxKnown = hasTaxRow || tax != null
  const costsTotal = named.reduce((s, c) => s + c.amount, 0)

  /**
   * The total is the SUM OF THE ROWS ABOVE IT, and that is the whole fix.
   *
   * It used to arrive from `planTotals`, which answers a different question — what leaves
   * his account before the key — while the rows answered "what is this deal made of". So
   * the card printed equity 700,000, costs 51,000, and a total of 661,500 beneath them:
   * anyone adding up what they could see got a number 89,500 away from the one the app
   * printed, and clearing browser data silently changed the total to 751,000 with nothing
   * about the deal having changed (NIGHT_RUN B-1).
   *
   * His money is simply everything he did not borrow: price − mortgage − other loans,
   * plus every cost including the tax. Whatever is still unpaid at handover is part of it
   * too; WHEN it leaves is the payment plan's question, not this card's.
   */
  const pocket = equity + costsTotal

  if (!(price > 0)) return null

  return (
    <section className="wlth-card wlth-deal">
      <div className="wlth-card-head">
        <h2>מבנה העסקה</h2>
        {/* "לא מתיישן" meant "these figures do not move" and read as a riddle — the sibling
            card uses this slot for a fact (חוב כולל …). A cryptic badge is worse than an
            empty slot, so until there is a fact worth putting here, nothing goes here. */}
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
      {!taxKnown && (
        <p className="wlth-deal-note warn">מס רכישה עוד לא חושב — הסכום הזה יגדל כשייקבע.</p>
      )}
      {costsTotal > 0 && (
        <p className="wlth-deal-note">
          {fmt(costsTotal)} מההוצאות לא הופכות להון — הן מחיר הכניסה.
        </p>
      )}
    </section>
  )
}
