import { useState } from 'react'
import { Check, Hourglass, CaretDown } from '@phosphor-icons/react'
import { formatCurrency, formatDate, todayISO, daysBetween } from '../../lib/format'
import { countdownLabel } from '../../lib/stage'
import {
  stages, currentStage, nextPayment, nextStep, planTotals, setDone,
  type PurchasePlan, type PlanItem, type StageNo,
} from '../../lib/purchasePlan'

const fmt = (v: number) => formatCurrency(v)

/**
 * מהחתימה עד המפתח — three stages, folded.
 *
 * The first build printed all fifteen items at once and the owner's verdict was immediate:
 * "לא נראה מספיק טוב". He was right, and the fix was structural rather than cosmetic — the
 * screen was answering "here is everything you will ever do" instead of "here is where you
 * are". The three stages are HIS division, quoted from how he described his own deal:
 *
 *   "מקובל לשלם ב-3 תשלומים — חתימה 10/15%, חודש — עד כאן הון עצמי. מסירת מפתח (משכנתא)."
 *
 * So: raise the equity · turn it into a flat · tie off the ends. A finished stage folds into
 * a single summary line carrying what it cost and when it closed — the fold keeps the
 * information instead of hiding it. The stage you are in is open; the one after is quiet.
 *
 * The headline sits ABOVE the stages and ignores them: the next payment is the next payment
 * wherever it lives, which is also the answer to "what if something urgent is buried in a
 * folded stage" — it simply is not buried.
 */
export function PurchaseMap({ plan, onChange, onSetup }: {
  plan: PurchasePlan
  onChange: (p: PurchasePlan) => void
  onSetup: () => void
}) {
  const today = todayISO()
  const all = stages(plan)
  const current = currentStage(plan)
  const next = nextPayment(plan)
  const step = nextStep(plan)
  const totals = planTotals(plan)

  // Opened by hand — a finished stage can be reopened to look, without changing anything.
  const [opened, setOpened] = useState<StageNo | null>(null)
  const openStage = opened ?? current
  const currentTitle = all.find(s => s.n === current)?.title ?? ''

  return (
    <div className="pmap">
      {next && (
        <div className="pmap-next">
          <div className="pmap-next-eyebrow">שלב {current} מתוך {all.length} · {currentTitle}</div>
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
          {/* When the very next thing is not the payment, name it once — so the headline
              answers "how much" without hiding "what actually comes first". */}
          {step && step.id !== next.id && (
            <div className="pmap-next-before">
              לפני זה: {step.label}
              {step.dep === 'third' && step.waitingOn ? ` · ממתין ל${step.waitingOn}` : ''}
            </div>
          )}
        </div>
      )}

      <div className="pmap-stages">
        {all.map(s => {
          const open = s.n === openStage
          return (
            <section key={s.n} className={`pmap-stage${s.done ? ' is-done' : ''}${open ? ' is-open' : ''}`}>
              <button
                className="pmap-stage-head"
                onClick={() => setOpened(open ? (s.n === current ? null : current) : s.n)}
                aria-expanded={open}
              >
                <span className={`pmap-stage-badge${s.done ? ' on' : ''}`}>
                  {s.done ? <Check size={13} weight="bold" /> : s.n}
                </span>
                <span className="pmap-stage-body">
                  <span className="pmap-stage-title">{s.title}</span>
                  <span className="pmap-stage-sub">
                    {s.done
                      ? <>הושלם{s.closedAt ? ` · ${formatDate(s.closedAt)}` : ''}{s.paid > 0 ? ` · ${fmt(s.paid)}` : ''}</>
                      : s.n === current
                        ? <>{s.doneCount} מתוך {s.items.length} הושלמו · נסגר כש{s.closes}</>
                        : <>{s.items.length} פריטים</>}
                  </span>
                </span>
                <CaretDown className="pmap-stage-caret" size={15} weight="bold" />
              </button>

              {open && (
                <ol className="pmap-list">
                  {s.items.map(item => (
                    <Row
                      key={item.id}
                      item={item}
                      today={today}
                      current={item.id === step?.id}
                      onToggle={() => onChange(setDone(plan, item.id, !item.done))}
                    />
                  ))}
                </ol>
              )}
            </section>
          )
        })}
      </div>

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
    <li className={`pmap-item${item.done ? ' is-done' : ''}${current ? ' is-current' : ''}`}>
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
            ? <span className="pmap-donetag">בוצע{item.doneAt ? ` · ${formatDate(item.doneAt)}` : ''}</span>
            : item.due
              ? <span className={overdue ? 'pmap-over' : ''}>
                  {formatDate(item.due)}{overdue ? ' · עבר' : ` · ${countdownLabel(daysBetween(today, item.due))}`}
                </span>
              : waiting
                ? <span className="pmap-wait"><Hourglass size={12} weight="bold" /> ממתין ל{item.waitingOn}</span>
                : <span>ללא תאריך</span>}
        </div>
        {/* The note is one-time knowledge. Show it on the item that is actually next, not on
            all fifteen — that alone was half the wall of text in the first build. */}
        {current && item.note && <div className="pmap-note">{item.note}</div>}
      </div>

      {item.amount > 0 && <div className="pmap-amt">{fmt(item.amount)}</div>}
    </li>
  )
}
