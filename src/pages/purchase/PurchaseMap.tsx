import { Check, Hourglass, CalendarBlank } from '@phosphor-icons/react'
import { formatCurrency, formatDate, todayISO, daysBetween } from '../../lib/format'
import { countdownLabel } from '../../lib/stage'
import {
  resolveDates, nextPayment, planTotals, setDone,
  type PurchasePlan, type PlanItem,
} from '../../lib/purchasePlan'

const fmt = (v: number) => formatCurrency(v)

/**
 * The map: one chronological run of payments and actions, in the order of the PROCESS.
 *
 * Three decisions from the interview are visible here and are the whole design:
 *
 *  1. **The headline is the next payment** — how much, and when. Nothing else competes.
 *  2. **The settled things are marked, never the forecast.** Early on almost everything is
 *     ahead of you; marking the unknown would have covered the screen in caveats. Instead the
 *     screen starts quiet and fills with green as things close — the list IS the progress bar.
 *  3. **Waiting looks different from your turn.** An item that waits on the lawyer or the
 *     bank says who it waits for; it does not sit there as a task you failed to do.
 *
 * An item with no date is not given one. "עד חודש משחרור הצ׳ק" has no date until the caution
 * is registered, and saying so is more useful than a guess.
 */
export function PurchaseMap({ plan, onChange, onSetup }: {
  plan: PurchasePlan
  onChange: (p: PurchasePlan) => void
  onSetup: () => void
}) {
  const today = todayISO()
  // Plain calls, no useMemo: the list is a dozen rows and the React compiler memoizes this
  // better than a hand-written dependency array (which it flags as unpreservable anyway).
  const items = resolveDates(plan)
  const next = nextPayment(plan)
  const totals = planTotals(plan)

  const currentId = items.find(i => !i.done)?.id

  return (
    <div className="pmap">
      {next && (
        <div className="pmap-next">
          <div className="pmap-next-label">התשלום הבא</div>
          <div className="pmap-next-value">{fmt(next.amount)}</div>
          <div className={`pmap-next-when${next.due && next.due < today ? ' is-over' : ''}`}>
            {!next.due
              ? <>ממתין ל{next.waitingOn ?? 'שער קודם'} — יקבל תאריך כשזה יקרה</>
              : next.due < today
                /* countdownLabel says "היום" for anything already past — true for a stage
                   that flips on a date, wrong for a payment that was due two months ago. */
                ? <>{formatDate(next.due)} · המועד עבר</>
                : <>{formatDate(next.due)} · {countdownLabel(daysBetween(today, next.due))}</>}
          </div>
        </div>
      )}

      <ol className="pmap-list">
        {items.map(item => (
          <Row
            key={item.id}
            item={item}
            today={today}
            current={item.id === currentId}
            onToggle={() => onChange(setDone(plan, item.id, !item.done))}
          />
        ))}
      </ol>

      {/* Progress lives away from the headline, small — his call: the big number is the next
          payment, not the total, because the total is the one that frightens people. */}
      <div className="pmap-progress">
        <div className="pmap-progress-top">
          <span>שולם {fmt(totals.paid)} מתוך {fmt(totals.fromPocket)}</span>
          <b>{Math.round(totals.paidPct)}%</b>
        </div>
        <div className="pmap-track"><div className="pmap-fill" style={{ width: `${totals.paidPct}%` }} /></div>
        <button className="pmap-edit" onClick={onSetup}>עריכת לוח התשלומים</button>
      </div>
    </div>
  )
}

function Row({ item, today, current, onToggle }: {
  item: PlanItem
  today: string
  current: boolean
  onToggle: () => void
}) {
  const overdue = !item.done && !!item.due && item.due < today
  const waiting = item.dep === 'third' && !item.done

  return (
    <li className={`pmap-item${item.done ? ' is-done' : ''}${current ? ' is-current' : ''}${waiting ? ' is-waiting' : ''}`}>
      <button
        className="pmap-mark"
        onClick={onToggle}
        aria-pressed={item.done}
        aria-label={item.done ? `לבטל סימון: ${item.label}` : `לסמן שבוצע: ${item.label}`}
      >
        {item.done ? <Check size={13} weight="bold" /> : null}
      </button>

      <div className="pmap-body">
        <div className="pmap-title">{item.label}</div>
        <div className="pmap-meta">
          {item.done
            ? <span className="pmap-donetag">בוצע</span>
            : item.due
              ? <span className={overdue ? 'pmap-over' : ''}>
                  <CalendarBlank size={12} weight="bold" /> {formatDate(item.due)}
                  {overdue ? ' · עבר' : ` · ${countdownLabel(daysBetween(today, item.due))}`}
                </span>
              : waiting
                ? <span className="pmap-wait"><Hourglass size={12} weight="bold" /> ממתין ל{item.waitingOn}</span>
                : <span>ללא תאריך</span>}
        </div>
        {item.note && <div className="pmap-note">{item.note}</div>}
      </div>

      {item.amount > 0 && <div className="pmap-amt">{fmt(item.amount)}</div>}
    </li>
  )
}
