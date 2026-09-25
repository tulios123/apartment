import { useState } from 'react'
import { Rocket, CaretDown } from '@phosphor-icons/react'
import type { PaymentSplit } from '../../lib/equity'
import { formatCurrency, formatMonthLabel } from '../../lib/format'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  /** This month's principal/interest split across amortizing vehicles. */
  current: PaymentSplit
  /** Principal portion of the payment in 5 years (Spitzer trajectory). */
  future5yPrincipal: number
  /** Total principal repaid over the next 12 months. */
  annualPrincipal: number
  /**
   * `YYYY-MM` when the figures are NOT this month's — nothing is paid yet (before
   * drawdown, or a grace period with no amortization). The ratio is still worth
   * showing; stating it as if it were happening now is not. Null when it is now.
   */
  fromMonth?: string | null
  /** This month is interest-only — a grace period, where nothing becomes equity. */
  inGrace?: boolean
  /** `YYYY-MM` the first principal appears, when it is known. */
  resumesMonth?: string | null
}

/**
 * Layer 2 — the Wealth Accelerator. Rebrands the monthly payment as forced
 * savings + a fee: how much builds equity (principal) vs how much is the bank's
 * interest, with the Spitzer trajectory and an annualized framing.
 */
export default function WealthAccelerator({ current, future5yPrincipal, annualPrincipal, fromMonth, inGrace, resumesMonth }: Props) {
  const [open, setOpen] = useState(false)
  if (current.total <= 0) return null
  const buildPct = (current.principal / current.total) * 100
  const interestPct = 100 - buildPct
  const monthLabel = fromMonth ? formatMonthLabel(fromMonth) : ''

  /**
   * During grace the bank takes interest only, so the split is 0% equity / 100% interest.
   * Drawn as the usual bar that reads as a verdict on how the owner is doing — Omer saw a
   * full red bar and an accelerator offering to accelerate something that has not started
   * (note 19). The owner's call (21.09): hide it during grace, behind a line he can open.
   *
   * It is not removed outright: the card is on this screen for a reason, and "why is it
   * gone" is a worse question than the one sentence that answers it.
   */
  if (inGrace) {
    return (
      <section className="wlth-card wlth-accel is-grace">
        <button type="button" className="wlth-accel-grace-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <Rocket size={18} weight="duotone" color="var(--text-muted)" />
          <span className="wlth-accel-grace-title">
            מאיץ ההון · בגרייס
            {resumesMonth ? <span className="wlth-card-note"> · מתחיל ב{formatMonthLabel(resumesMonth)}</span> : null}
          </span>
          <CaretDown size={16} weight="bold" className={`wlth-accel-caret${open ? ' is-open' : ''}`} />
        </button>
        {open && (
          <p className="wlth-accel-grace-body">
            בתקופת הגרייס הבנק גובה ריבית בלבד — מהתשלום החודשי של {fmt(current.total)} לא נכנס שקל להון.
            {resumesMonth
              ? ` מ${formatMonthLabel(resumesMonth)}, כשמתחיל החזר הקרן, המאיץ יראה כמה מכל תשלום בונה לך הון.`
              : ' כשיתחיל החזר הקרן, המאיץ יראה כמה מכל תשלום בונה לך הון.'}
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="wlth-card wlth-accel">
      <div className="wlth-card-head">
        <Rocket size={18} weight="duotone" color="var(--brand-navy)" />
        <h2>מאיץ ההון</h2>
        <span className="wlth-card-note">
          {monthLabel ? `מכל תשלום של ${fmt(current.total)} · מ${monthLabel}` : `מכל תשלום חודשי של ${fmt(current.total)}`}
        </span>
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
          <div className="hint">ריבית לבנק</div>
        </div>
      </div>

      <ul className="wlth-accel-notes">
        {future5yPrincipal > current.principal && (
          <li>היחס משתפר בכל חודש — בעוד 5 שנים <b>{fmt(future5yPrincipal)}</b> מכל תשלום יבנו הון.</li>
        )}
        {annualPrincipal > 0 && (
          <li>השנה תמיר <b>{fmt(annualPrincipal)}</b> מתשלומים להון עצמי.</li>
        )}
      </ul>
    </section>
  )
}
