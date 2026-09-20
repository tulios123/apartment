import { useMemo, useState } from 'react'
import { CalendarBlank, Hourglass, UserCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { PROCESS, itemDate, DEP_LABEL, type Dependency, type ProcessItem } from './processModel'
import { formatDate, todayISO, daysBetween, parseLocalISO, monthDayISO } from '../../lib/format'
import { countdownLabel } from '../../lib/stage'
import './process-preview.css'

/**
 * A picture of the purchase process, for the owner to look at and argue with. Staging only.
 *
 * It answers ONE question and deliberately no others: **do the three dependency classes
 * need three different behaviours?** So a date item shows a date and cannot be ticked
 * early; an item that depends only on you has a tick and no date; an item waiting on a
 * bank or a lawyer has no tick at all — it moves between states.
 *
 * Nothing here writes anything. It reads no account. It is not the task engine and must
 * not become it by accident: the shape gets agreed first, then it gets built once.
 */

const DEMO_SIGNING_DAYS_AGO = 60
const DEMO_HANDOVER_IN_DAYS = 213

type ThirdState = 'todo' | 'sent' | 'back'

const DEP_ICON: Record<Dependency, typeof CalendarBlank> = {
  date: CalendarBlank,
  you: UserCircle,
  third: Hourglass,
}

function shiftToday(days: number): string {
  const d = parseLocalISO(todayISO())
  d.setDate(d.getDate() + days)
  return monthDayISO(d)
}

/** The 15th of the coming month — the construction-index publication, a recurring clock. */
function nextIndexDate(): string {
  const t = parseLocalISO(todayISO())
  const d = new Date(t.getFullYear(), t.getMonth(), 15)
  if (d < t) d.setMonth(d.getMonth() + 1)
  return monthDayISO(d)
}

export default function ProcessPreview() {
  const [developer, setDeveloper] = useState(true)
  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const [third, setThird] = useState<Record<string, ThirdState>>({})

  const signing = useMemo(() => shiftToday(-DEMO_SIGNING_DAYS_AGO), [])
  const handover = useMemo(() => shiftToday(DEMO_HANDOVER_IN_DAYS), [])
  const today = todayISO()

  const phases = useMemo(
    () => PROCESS.map(p => ({ ...p, items: p.items.filter(i => developer || !i.developerOnly) }))
      .filter(p => p.items.length > 0),
    [developer],
  )

  const counts = useMemo(() => {
    const all = phases.flatMap(p => p.items)
    return {
      you: all.filter(i => i.dep === 'you' && !ticked[i.id]).length,
      third: all.filter(i => i.dep === 'third' && third[i.id] !== 'back').length,
      passed: all.filter(i => {
        const d = itemDate(i, signing, handover)
        return i.dep === 'date' && d != null && d < today
      }).length,
    }
  }, [phases, ticked, third, signing, handover, today])

  function renderItem(item: ProcessItem) {
    const date = item.anchor === 'monthly' ? nextIndexDate() : itemDate(item, signing, handover)
    const past = date != null && date < today
    const Icon = DEP_ICON[item.dep]
    const state = third[item.id] ?? 'todo'
    const done = item.dep === 'third' ? state === 'back' : !!ticked[item.id]

    return (
      <li key={item.id} className={`pv-item dep-${item.dep}${done ? ' is-done' : ''}${past && item.dep === 'date' && !done ? ' is-past' : ''}`}>
        <span className="pv-item-icon"><Icon size={17} weight="duotone" /></span>

        <div className="pv-item-body">
          <div className="pv-item-title">{item.title}</div>
          {date && (
            <div className="pv-item-when">
              {item.anchor === 'monthly' ? <><ArrowsClockwise size={12} weight="bold" /> כל חודש · הבא {formatDate(date)}</>
                : past ? <>עבר · {formatDate(date)}</>
                : <>{formatDate(date)} · {countdownLabel(daysBetween(today, date))}</>}
            </div>
          )}
          {item.waitingOn && <div className="pv-item-when">ממתין ל{item.waitingOn}</div>}
          {item.note && <div className="pv-item-note">{item.note}</div>}
        </div>

        {/* Three classes, three controls — the entire point of this page. */}
        {item.dep === 'you' && (
          <button
            className={`pv-tick${ticked[item.id] ? ' on' : ''}`}
            aria-pressed={!!ticked[item.id]}
            onClick={() => setTicked(t => ({ ...t, [item.id]: !t[item.id] }))}
          >{ticked[item.id] ? 'בוצע' : 'סמן'}</button>
        )}
        {item.dep === 'third' && (
          <button
            className={`pv-state st-${state}`}
            onClick={() => setThird(s => ({ ...s, [item.id]: state === 'todo' ? 'sent' : state === 'sent' ? 'back' : 'todo' }))}
          >{state === 'todo' ? 'לפתוח' : state === 'sent' ? 'ממתין' : 'חזר'}</button>
        )}
        {item.dep === 'date' && <span className="pv-locked">{DEP_LABEL.date}</span>}
      </li>
    )
  }

  return (
    <div className="page pv">
      <div className="pv-banner">
        תצוגה מקדימה · לא מחובר לנתונים ולא נשמר. נועד להסתכל ולהתווכח.
      </div>

      <div className="page-header">
        <h1>תהליך הרכישה</h1>
      </div>

      <div className="pv-summary">
        <div><b>{counts.you}</b><span>אפשר לקדם עכשיו</span></div>
        <div><b>{counts.third}</b><span>ממתין לאחרים</span></div>
        <div><b>{counts.passed}</b><span>מועד שכבר עבר</span></div>
      </div>

      <div className="pv-toggle">
        <button className={developer ? 'on' : ''} onClick={() => setDeveloper(true)}>מקבלן</button>
        <button className={!developer ? 'on' : ''} onClick={() => setDeveloper(false)}>יד שנייה</button>
      </div>

      <p className="pv-caption">
        חתימה {formatDate(signing)} · מסירה {formatDate(handover)}
      </p>

      {phases.map(p => (
        <section key={p.id} className="pv-phase">
          <div className="pv-phase-head">
            <h2>{p.title}</h2>
            <span>{p.clock}</span>
          </div>
          <ul className="pv-list">{p.items.map(renderItem)}</ul>
        </section>
      ))}

      <p className="pv-caption pv-foot">
        המקורות לכל שורה: <code>docs/specs/purchase-process.md</code>
      </p>
    </div>
  )
}
