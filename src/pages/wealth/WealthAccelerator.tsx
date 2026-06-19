import { Rocket } from '@phosphor-icons/react'
import type { PaymentSplit } from '../../lib/equity'
import { formatCurrency } from '../../lib/format'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  /** This month's principal/interest split across amortizing vehicles. */
  current: PaymentSplit
  /** Principal portion of the payment in 5 years (Spitzer trajectory). */
  future5yPrincipal: number
  /** Total principal repaid over the next 12 months. */
  annualPrincipal: number
  /** Whether a balloon (no-monthly-payment) loan exists. */
  hasBalloon: boolean
}

/**
 * Layer 2 — the Wealth Accelerator. Rebrands the monthly payment as forced
 * savings + a fee: how much builds equity (principal) vs how much is the bank's
 * interest, with the Spitzer trajectory and an annualized framing.
 */
export default function WealthAccelerator({ current, future5yPrincipal, annualPrincipal, hasBalloon }: Props) {
  if (current.total <= 0) return null
  const buildPct = (current.principal / current.total) * 100
  const interestPct = 100 - buildPct

  return (
    <section className="wlth-card wlth-accel">
      <div className="wlth-card-head">
        <Rocket size={18} weight="duotone" color="var(--brand-navy)" />
        <h2>מאיץ ההון</h2>
        <span className="wlth-card-note">מכל תשלום חודשי של {fmt(current.total)}</span>
      </div>

      <div className="wlth-split-bar">
        <div className="seg build" style={{ width: `${buildPct}%` }} />
        <div className="seg interest" style={{ width: `${interestPct}%` }} />
      </div>

      <div className="wlth-split-cols">
        <div className="wlth-split-col build">
          <div className="amt">{fmt(current.principal)}</div>
          <div className="lbl">בונה הון <b>({buildPct.toFixed(0)}%)</b></div>
          <div className="hint">נכנס לכיס שלך</div>
        </div>
        <div className="wlth-split-col interest">
          <div className="amt">{fmt(current.interest)}</div>
          <div className="lbl">ריבית <b>({interestPct.toFixed(0)}%)</b></div>
          <div className="hint">עמלה לבנק</div>
        </div>
      </div>

      <ul className="wlth-accel-notes">
        {future5yPrincipal > current.principal && (
          <li>היחס משתפר בכל חודש — בעוד 5 שנים <b>{fmt(future5yPrincipal)}</b> מכל תשלום יבנו הון.</li>
        )}
        {annualPrincipal > 0 && (
          <li>השנה תמיר <b>{fmt(annualPrincipal)}</b> מתשלומים להון עצמי.</li>
        )}
        {hasBalloon && (
          <li className="muted">הלוואת המשפחה (בלון): ללא תשלום חודשי · נפרעת במכירה.</li>
        )}
      </ul>
    </section>
  )
}
