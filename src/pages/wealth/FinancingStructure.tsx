import { useState } from 'react'
import { Bank, CreditCard, Handshake, CaretDown, PencilSimple } from '@phosphor-icons/react'
import { trackSchedule } from '../../lib/mortgage'
import { loanBalance, loanMonthlyPayment, loanEndDate } from '../../lib/loans'
import { formatCurrency, todayISO, parseLocalISO, monthDayISO } from '../../lib/format'
import type { MortgageTrack, Loan, TrackType } from '../../types'
import type { MortgageSummary } from '../../hooks/useMortgageData'

const fmt = (v: number) => formatCurrency(v)
const yearOf = (d: string | null) => (d ? new Date(d).getFullYear() : null)

const TRACK_LABEL: Record<TrackType, string> = { prime: 'פריים', fixed_unlinked: 'קבועה לא צמודה', fixed_linked: 'קבועה צמודה', variable: 'משתנה' }
const TRACK_COLOR: Record<TrackType, string> = { prime: '#5aa0ec', fixed_unlinked: 'var(--accent-teal)', fixed_linked: 'var(--accent-2)', variable: '#f0b24e' }

interface Props {
  tracks: MortgageTrack[]
  summary: MortgageSummary
  monthlyLoans: Loan[]
  balloonLoans: Loan[]
  onEdit: () => void
}

/**
 * Layer 3 — the financing structure. Three ranked vehicles with one consistent
 * row anatomy: the mortgage as an aggregated parent (expandable to its tracks),
 * the supplementary bank loan, and the softened family balloon. Read-only; the
 * pencil opens the shared edit drawer.
 */
export default function FinancingStructure({ tracks, summary, monthlyLoans, balloonLoans, onEdit }: Props) {
  const [open, setOpen] = useState(false)

  const mortgageBalance = summary.currentBalance || 0
  // Principal-weighted average rate. Guard the denominator (not just tracks.length)
  // so a stray 0-principal track can't produce NaN% in the blended-rate label.
  const trackPrincipal = tracks.reduce((s, t) => s + (Number(t.principal) || 0), 0)   // numeric cols → strings; coerce before summing
  const blendedRate = trackPrincipal > 0
    ? tracks.reduce((s, t) => s + (Number(t.annual_rate) || 0) * (Number(t.principal) || 0), 0) / trackPrincipal
    : 0
  const mortgagePaidPct = summary.totalPrincipal > 0 ? ((summary.totalPrincipal - mortgageBalance) / summary.totalPrincipal) * 100 : 0

  const loanBal = monthlyLoans.reduce((s, l) => s + loanBalance(l), 0)
  const balloonBal = balloonLoans.reduce((s, l) => s + (Number(l.principal) || 0), 0)   // numeric col → string; coerce before summing
  const totalDebt = mortgageBalance + loanBal + balloonBal

  // Latest payoff year across all mortgage tracks — "how much is left" in time.
  const mortgageEndYear = tracks.reduce((max, t) => {
    const sched = trackSchedule(t)
    const y = sched.length ? new Date(sched[sched.length - 1].date).getFullYear() : 0
    return Math.max(max, y)
  }, 0)

  // A6: show what the bank actually withdraws THIS month (schedule-bounded), not the
  // post-grace Shpitzer level — so the card matches the תזרים forecast row. A track in
  // its grace window pays interest-only; surface that with a "גרייס עד" tag + the full
  // (post-grace) payment as a secondary line, instead of silently showing the higher figure.
  const curMonth = todayISO().slice(0, 7)
  const currentMonthlyPayment = tracks.reduce((s, t) => {
    const row = trackSchedule(t).find(r => r.date.slice(0, 7) === curMonth)
    return s + (row?.payment ?? 0)
  }, 0)
  const todayStr = todayISO()
  const graceEnds = tracks
    .filter(t => (t.grace_months ?? 0) > 0)
    .map(t => { const d = parseLocalISO(t.start_date); d.setMonth(d.getMonth() + (t.grace_months ?? 0)); return monthDayISO(d) })
    .filter(end => end > todayStr)
    .sort()
  const inGrace = graceEnds.length > 0
  const graceUntil = inGrace ? (() => { const [y, m] = graceEnds[graceEnds.length - 1].split('-'); return `${Number(m)}.${y}` })() : ''

  function trackBalance(t: MortgageTrack): number {
    const today = todayISO()
    const sched = trackSchedule(t)
    const lastPaid = [...sched].reverse().find(r => r.date <= today)
    return lastPaid ? lastPaid.balance : (Number(t.principal) || 0)
  }

  return (
    <section className="wlth-card wlth-fin">
      <div className="wlth-card-head">
        <h2>מבנה המימון</h2>
        <span className="wlth-card-note">חוב כולל {fmt(totalDebt)}</span>
        <button className="wlth-edit-icon" onClick={onEdit} aria-label="ערוך מימון" title="ערוך מימון"><PencilSimple size={16} /></button>
      </div>

      {/* 1 — Main mortgage (aggregated parent) */}
      {tracks.length > 0 && (
        <div className={`wlth-vehicle${open ? ' open' : ''}`}>
          <button className="wlth-vehicle-head" onClick={() => setOpen(o => !o)}>
            <span className="wlth-vehicle-icon"><Bank size={20} weight="duotone" /></span>
            <div className="wlth-vehicle-main">
              <div className="wlth-vehicle-title">משכנתא ראשית <span className="wlth-vehicle-meta">· {tracks.length} מסלולים</span></div>
              <div className="wlth-vehicle-sub">בלנדד {blendedRate.toFixed(1)}% · {fmt(currentMonthlyPayment)}/חודש · נפרעו {Math.round(mortgagePaidPct)}%{mortgageEndYear > 0 ? ` · עד ${mortgageEndYear}` : ''}</div>
              {inGrace && <div className="wlth-vehicle-grace">גרייס עד {graceUntil} · תשלום מלא {fmt(summary.monthlyPayment)}</div>}
            </div>
            <div className="wlth-vehicle-bal"><b>{fmt(mortgageBalance)}</b><span>יתרה</span></div>
            <CaretDown className="wlth-vehicle-caret" size={16} weight="bold" />
          </button>
          {/* Payoff progress */}
          <div className="wlth-progress">
            <div className="wlth-progress-track"><div className="wlth-progress-fill" style={{ width: `${Math.min(100, Math.max(0, mortgagePaidPct))}%` }} /></div>
            <span className="wlth-progress-label">נפרעו {Math.round(mortgagePaidPct)}% · נותרו {fmt(mortgageBalance)}</span>
          </div>
          {open && (
            <div className="wlth-tracks">
              {tracks.map(t => (
                <div key={t.id} className="wlth-track-row">
                  <span className="wlth-track-dot" style={{ background: TRACK_COLOR[t.track_type] }} />
                  <span className="wlth-track-name">{TRACK_LABEL[t.track_type]}{t.label ? ` · ${t.label}` : ''}</span>
                  <span className="wlth-track-rate">{t.annual_rate.toFixed(1)}%</span>
                  <span className="wlth-track-bal">{fmt(trackBalance(t))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2 — Supplementary bank loans */}
      {monthlyLoans.map(l => {
        const paidPct = l.principal > 0 ? Math.max(0, Math.min(100, (1 - loanBalance(l) / l.principal) * 100)) : 0
        return (
          <div key={l.id} className="wlth-vehicle static">
            <div className="wlth-vehicle-head">
              <span className="wlth-vehicle-icon"><CreditCard size={20} weight="duotone" /></span>
              <div className="wlth-vehicle-main">
                <div className="wlth-vehicle-title">{l.label || 'הלוואה משלימה'}{l.lender ? <span className="wlth-vehicle-meta"> · {l.lender}</span> : null}</div>
                <div className="wlth-vehicle-sub">{[l.annual_rate != null ? `${l.annual_rate.toFixed(1)}%` : null, `${fmt(loanMonthlyPayment(l))}/חודש`, loanEndDate(l) ? `סיום ${yearOf(loanEndDate(l))}` : null].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="wlth-vehicle-bal"><b>{fmt(loanBalance(l))}</b><span>יתרה</span></div>
            </div>
            <div className="wlth-progress">
              <div className="wlth-progress-track"><div className="wlth-progress-fill" style={{ width: `${paidPct}%` }} /></div>
              <span className="wlth-progress-label">נפרעו {Math.round(paidPct)}% · נותרו {fmt(loanBalance(l))}</span>
            </div>
          </div>
        )
      })}

      {/* 3 — Family balloon (softened) */}
      {balloonLoans.map(l => (
        <div key={l.id} className="wlth-vehicle balloon">
          <div className="wlth-vehicle-head">
            <span className="wlth-vehicle-icon"><Handshake size={20} weight="duotone" /></span>
            <div className="wlth-vehicle-main">
              <div className="wlth-vehicle-title">{l.label || 'הלוואת בלון'}{l.lender && l.lender !== (l.label || 'הלוואת בלון') ? <span className="wlth-vehicle-meta"> · {l.lender}</span> : null}</div>
              <div className="wlth-vehicle-sub">ללא ריבית · ללא תשלום חודשי · נפרעת במכירה</div>
            </div>
            <div className="wlth-vehicle-bal"><b>{fmt(l.principal)}</b><span>נפרעת במכירה</span></div>
          </div>
        </div>
      ))}
    </section>
  )
}
