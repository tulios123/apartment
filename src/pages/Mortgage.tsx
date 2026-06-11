import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useMortgageData,
  ensureMortgage,
  upsertMortgageTrack,
  deleteMortgageTrack,
} from '../hooks/useMortgageData'
import { monthlyPayment, trackSchedule } from '../lib/mortgage'
import { MORTGAGE_TRACK_TYPES } from '../lib/constants'
import { formatCurrency, formatDate } from '../lib/format'
import type { MortgageTrack, TrackType } from '../types'
import type { ScheduleRow } from '../lib/mortgage'

const TODAY = new Date().toISOString().slice(0, 10)

interface TrackForm {
  id?: string
  label: string
  track_type: TrackType
  principal: string
  annual_rate: string
  prime_rate: string    // only for prime track type
  margin: string        // only for prime track type
  term_months: string
  grace_months: string
  start_date: string
}

function emptyForm(): TrackForm {
  return {
    label: '',
    track_type: 'fixed_unlinked',
    principal: '',
    annual_rate: '',
    prime_rate: '',
    margin: '',
    term_months: '',
    grace_months: '',
    start_date: TODAY,
  }
}

function formFromTrack(t: MortgageTrack): TrackForm {
  return {
    id: t.id,
    label: t.label ?? '',
    track_type: t.track_type as TrackType,
    principal: String(Math.round(t.principal)),
    annual_rate: t.annual_rate.toFixed(3),
    prime_rate: '',
    margin: '',
    term_months: String(t.term_months),
    grace_months: t.grace_months ? String(t.grace_months) : '',
    start_date: t.start_date,
  }
}

function effectiveRate(form: TrackForm): number {
  if (form.track_type === 'prime') {
    const p = parseFloat(form.prime_rate) || 0
    const m = parseFloat(form.margin) || 0
    return p + m
  }
  return parseFloat(form.annual_rate) || 0
}

function previewPayment(form: TrackForm): number {
  const p = parseFloat(form.principal) || 0
  const r = effectiveRate(form)
  const n = parseInt(form.term_months) || 0
  const g = parseInt(form.grace_months) || 0
  return monthlyPayment(p, r, n, g)
}

function gracePayment(form: TrackForm): number {
  const p = parseFloat(form.principal) || 0
  const r = effectiveRate(form) / 100 / 12
  return p * r
}

interface YearRow {
  year: number
  totalPayment: number
  totalInterest: number
  totalPrincipal: number
  endBalance: number
  months: ScheduleRow[]
}

function groupByYear(rows: ScheduleRow[]): YearRow[] {
  const byYear = new Map<number, ScheduleRow[]>()
  for (const row of rows) {
    const y = parseInt(row.date.slice(0, 4))
    const arr = byYear.get(y) ?? []
    arr.push(row)
    byYear.set(y, arr)
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, months]) => ({
      year,
      totalPayment: months.reduce((s, r) => s + r.payment, 0),
      totalInterest: months.reduce((s, r) => s + r.interest, 0),
      totalPrincipal: months.reduce((s, r) => s + r.principal, 0),
      endBalance: months[months.length - 1].balance,
      months,
    }))
}

const MONTH_NAMES = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']

export default function MortgagePage() {
  const { user } = useAuth()
  const { mortgage, tracks, combined, summary, loading, error, refetch } = useMortgageData()

  const [form, setForm] = useState<TrackForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [graceEdit, setGraceEdit] = useState<{ trackId: string; enabled: boolean; months: string } | null>(null)
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())
  const [scheduleTrackFilter, setScheduleTrackFilter] = useState<string>('all')

  const yearRows = useMemo(() => {
    if (scheduleTrackFilter === 'all') return groupByYear(combined)
    const filtered = tracks.find(t => t.id === scheduleTrackFilter)
    if (!filtered) return []
    return groupByYear(trackSchedule(filtered))
  }, [combined, scheduleTrackFilter, tracks])

  function toggleYear(y: number) {
    setExpandedYears(prev => {
      const next = new Set(prev)
      next.has(y) ? next.delete(y) : next.add(y)
      return next
    })
  }

  function setField<K extends keyof TrackForm>(key: K, val: TrackForm[K]) {
    setForm(f => f ? { ...f, [key]: val } : f)
  }

  async function handleSave() {
    if (!form || !user) return
    setSaving(true)
    setSaveErr(null)
    try {
      const mortgageRow = mortgage ?? await ensureMortgage(user.id)
      const rate = effectiveRate(form)
      await upsertMortgageTrack({
        id: form.id,
        mortgage_id: mortgageRow.id,
        owner_id: user.id,
        label: form.label.trim() || null,
        track_type: form.track_type,
        principal: parseFloat(form.principal) || 0,
        annual_rate: rate,
        term_months: parseInt(form.term_months) || 0,
        grace_months: parseInt(form.grace_months) || 0,
        start_date: form.start_date,
      })
      await refetch()
      setForm(null)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק מסלול זה?')) return
    try {
      await deleteMortgageTrack(id)
      await refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה')
    }
  }

  async function saveGrace(track: MortgageTrack) {
    if (!graceEdit || !user) return
    const grace = graceEdit.enabled ? (parseInt(graceEdit.months) || 0) : 0
    try {
      await upsertMortgageTrack({
        id: track.id,
        mortgage_id: track.mortgage_id,
        owner_id: user.id,
        label: track.label,
        track_type: track.track_type,
        principal: track.principal,
        annual_rate: track.annual_rate,
        term_months: track.term_months,
        grace_months: grace,
        start_date: track.start_date,
      })
      await refetch()
      setGraceEdit(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה')
    }
  }

  if (loading) return <div className="empty-state">טוען...</div>
  if (error) return <div className="form-error">{error}</div>

  const preview = form ? previewPayment(form) : 0
  const effectiveRateVal = form ? effectiveRate(form) : 0

  const hasGrace = tracks.some(t => (t.grace_months ?? 0) > 0)
  const gracePeriodPayment = hasGrace
    ? tracks.reduce((s, t) => {
        const r = t.annual_rate / 100 / 12
        return s + ((t.grace_months ?? 0) > 0
          ? t.principal * r                                           // interest-only during grace
          : monthlyPayment(t.principal, t.annual_rate, t.term_months, 0))  // full Shpitzer if no grace
      }, 0)
    : 0

  return (
    <div className="page mortgage-page">
      <div className="page-header">
        <h1>משכנתא</h1>
      </div>

      {/* ── Summary cards ── */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">יתרת הלוואה</div>
          <div className="summary-amount">{formatCurrency(summary.currentBalance)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">תשלום חודשי</div>
          {hasGrace ? (
            <>
              <div className="mortgage-payment-split">
                <span className="mortgage-payment-split-label">בגרייס</span>
                <span className="summary-amount">{formatCurrency(gracePeriodPayment)}</span>
              </div>
              <div className="mortgage-payment-split">
                <span className="mortgage-payment-split-label">לאחר גרייס</span>
                <span className="summary-amount">{formatCurrency(summary.monthlyPayment)}</span>
              </div>
            </>
          ) : (
            <div className="summary-amount">{formatCurrency(summary.monthlyPayment)}</div>
          )}
        </div>
        <div className="summary-card">
          <div className="summary-label">סה״כ ריבית לאורך חיי ההלוואה</div>
          <div className="summary-amount negative">{formatCurrency(summary.totalInterestLife)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">ריבית ששולמה עד היום</div>
          <div className="summary-amount">{formatCurrency(summary.interestPaidToDate)}</div>
        </div>
      </div>

      {/* ── מסלולים ── */}
      <section className="mortgage-tracks-section">
        <div className="mortgage-section-header">
          <h2>תמהיל מסלולים</h2>
          {!form && (
            <button className="btn-primary" onClick={() => setForm(emptyForm())}>
              + הוסף מסלול
            </button>
          )}
        </div>

        {tracks.length === 0 && !form && (
          <div className="empty-state">אין מסלולים. הוסף מסלול ראשון.</div>
        )}

        {/* Existing tracks */}
        {tracks.map(track => (
          <div key={track.id} className="prop-card mortgage-track-card">
            <div className="mortgage-track-row">
              <div className="mortgage-track-info">
                <span className="mortgage-track-type">
                  {MORTGAGE_TRACK_TYPES.find(t => t.value === track.track_type)?.label ?? track.track_type}
                </span>
                {track.label && <span className="mortgage-track-label">{track.label}</span>}
                {graceEdit?.trackId === track.id ? (
                  <span className="grace-inline-edit">
                    <label className="grace-checkbox-label" style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={graceEdit.enabled}
                        onChange={e => setGraceEdit(g => g ? { ...g, enabled: e.target.checked, months: e.target.checked ? (g.months || '12') : g.months } : g)}
                      />
                      גרייס
                    </label>
                    {graceEdit.enabled && (
                      <input
                        type="number"
                        className="grace-months-input"
                        value={graceEdit.months}
                        onChange={e => setGraceEdit(g => g ? { ...g, months: e.target.value } : g)}
                        min="1"
                        autoFocus
                      />
                    )}
                    <button className="btn-primary btn-xs" onClick={() => saveGrace(track)}>שמור</button>
                    <button className="btn-secondary btn-xs" onClick={() => setGraceEdit(null)}>ביטול</button>
                  </span>
                ) : (track.grace_months ?? 0) > 0 ? (
                  <span className="grace-badge grace-badge-clickable" onClick={() => setGraceEdit({ trackId: track.id, enabled: true, months: String(track.grace_months) })}>
                    גרייס {track.grace_months} חודשים ✎
                  </span>
                ) : (
                  <span className="grace-badge grace-badge-empty" onClick={() => setGraceEdit({ trackId: track.id, enabled: false, months: '12' })}>
                    + הוסף גרייס
                  </span>
                )}
              </div>
              <div className="mortgage-track-numbers">
                <span>קרן: <strong>{formatCurrency(track.principal)}</strong></span>
                <span>ריבית: <strong>{track.annual_rate.toFixed(3)}%</strong></span>
                <span>תקופה: <strong>{track.term_months} חודשים</strong></span>
                <span>תשלום: <strong>{formatCurrency(monthlyPayment(track.principal, track.annual_rate, track.term_months, track.grace_months ?? 0))}</strong></span>
              </div>
              <div className="mortgage-track-meta">
                <span>מתאריך {formatDate(track.start_date)}</span>
              </div>
              <div className="mortgage-track-actions">
                <button className="btn-secondary btn-sm" onClick={() => setForm(formFromTrack(track))}>
                  ערוך
                </button>
                <button className="btn-icon danger" onClick={() => handleDelete(track.id)} title="מחק">
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add / edit form */}
        {form && (
          <div className="prop-card mortgage-form-card">
            <h3>{form.id ? 'עריכת מסלול' : 'מסלול חדש'}</h3>

            <div className="form-row">
              <label>סוג מסלול</label>
              <select
                value={form.track_type}
                onChange={e => setField('track_type', e.target.value as TrackType)}
                className="form-input"
              >
                {MORTGAGE_TRACK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label>תיאור (אופציונלי)</label>
              <input
                type="text"
                className="form-input"
                value={form.label}
                onChange={e => setField('label', e.target.value)}
                placeholder="למשל: מסלול פריים"
              />
            </div>

            <div className="form-row">
              <label>קרן (₪)</label>
              <input
                type="number"
                className="form-input"
                value={form.principal}
                onChange={e => setField('principal', e.target.value)}
                placeholder="1,000,000"
                min="0"
              />
            </div>

            <div className="form-2col">
              <div className="form-row">
                <label>תקופה (חודשים)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.term_months}
                  onChange={e => setField('term_months', e.target.value)}
                  placeholder="360"
                  min="1"
                  max="600"
                />
                {parseInt(form.term_months) > 0 && (
                  <span className="form-hint">= {(parseInt(form.term_months) / 12).toFixed(1)} שנים</span>
                )}
              </div>
              <div className="form-row">
                <label className="grace-checkbox-label">
                  <input
                    type="checkbox"
                    checked={parseInt(form.grace_months) > 0}
                    onChange={e => setField('grace_months', e.target.checked ? '12' : '')}
                  />
                  גרייס
                </label>
                {parseInt(form.grace_months) > 0 && (
                  <input
                    type="number"
                    className="form-input"
                    value={form.grace_months}
                    onChange={e => setField('grace_months', e.target.value)}
                    placeholder="12"
                    min="1"
                  />
                )}
                {parseInt(form.grace_months) > 0 && (
                  <span className="form-hint">חודשי ריבית בלבד</span>
                )}
              </div>
            </div>

            {form.track_type === 'prime' ? (
              <div className="form-2col">
                <div className="form-row">
                  <label>ריבית פריים נוכחית (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.prime_rate}
                    onChange={e => setField('prime_rate', e.target.value)}
                    placeholder="6.0"
                    step="0.001"
                  />
                </div>
                <div className="form-row">
                  <label>מרווח / מרג'ין (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.margin}
                    onChange={e => setField('margin', e.target.value)}
                    placeholder="-0.5"
                    step="0.001"
                  />
                </div>
              </div>
            ) : (
              <div className="form-row">
                <label>ריבית שנתית (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.annual_rate}
                  onChange={e => setField('annual_rate', e.target.value)}
                  placeholder="5.250"
                  step="0.001"
                  min="0"
                />
              </div>
            )}

            {form.track_type === 'prime' && (
              <div className="mortgage-effective-rate">
                ריבית אפקטיבית: <strong>{effectiveRateVal.toFixed(3)}%</strong>
              </div>
            )}

            <div className="form-row">
              <label>תאריך התחלה</label>
              <input
                type="date"
                className="form-input"
                value={form.start_date}
                onChange={e => setField('start_date', e.target.value)}
              />
            </div>

            {/* Live payment preview */}
            {preview > 0 && (
              <div className="mortgage-payment-preview">
                {parseInt(form.grace_months) > 0 ? (
                  <>
                    <div>בגרייס ({form.grace_months} חודשים): <strong>{formatCurrency(gracePayment(form))}</strong> ריבית בלבד</div>
                    <div>לאחר גרייס: <strong>{formatCurrency(preview)}</strong> לחודש</div>
                  </>
                ) : (
                  <>תשלום חודשי משוער: <strong>{formatCurrency(preview)}</strong></>
                )}
              </div>
            )}

            {saveErr && <div className="form-error">{saveErr}</div>}

            <div className="form-actions">
              <button className="btn-secondary" onClick={() => { setForm(null); setSaveErr(null) }} disabled={saving}>
                ביטול
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'שומר...' : 'שמור מסלול'}
              </button>
            </div>
          </div>
        )}

        {/* v1 note for CPI/variable tracks */}
        {tracks.some(t => t.track_type === 'fixed_linked' || t.track_type === 'variable') && (
          <p className="mortgage-note">
            * מסלולים צמודי מדד/משתנים מחושבים לפי הריבית הנוכחית, ללא הצמדה עתידית.
          </p>
        )}
      </section>

      {/* ── Amortization schedule ── */}
      {combined.length > 0 && (
        <section className="mortgage-schedule-section">
          <div className="mortgage-section-header">
            <h2>לוח סילוקין</h2>
            {tracks.length > 1 && (
              <select
                className="form-input mortgage-track-filter"
                value={scheduleTrackFilter}
                onChange={e => setScheduleTrackFilter(e.target.value)}
              >
                <option value="all">כל המסלולים</option>
                {tracks.map(t => (
                  <option key={t.id} value={t.id}>
                    {MORTGAGE_TRACK_TYPES.find(x => x.value === t.track_type)?.label ?? t.track_type}
                    {t.label ? ` – ${t.label}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="prop-card">
            <table className="mortgage-schedule-table">
              <thead>
                <tr>
                  <th></th>
                  <th>שנה</th>
                  <th>תשלום חודשי</th>
                  <th>ריבית חודשית</th>
                  <th>קרן חודשית</th>
                  <th>יתרה</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map(yr => {
                  const rep = yr.months[0]
                  return (
                  <>
                    <tr
                      key={yr.year}
                      className="mortgage-year-row"
                      onClick={() => toggleYear(yr.year)}
                    >
                      <td className="mortgage-expand-btn">{expandedYears.has(yr.year) ? '▾' : '▸'}</td>
                      <td><strong>{yr.year}</strong></td>
                      <td>{formatCurrency(rep.payment)}</td>
                      <td className="negative">{formatCurrency(rep.interest)}</td>
                      <td>{formatCurrency(rep.principal)}</td>
                      <td>{formatCurrency(yr.endBalance)}</td>
                    </tr>
                    {expandedYears.has(yr.year) && yr.months.map(row => (
                      <tr key={row.date} className="mortgage-month-row">
                        <td></td>
                        <td className="mortgage-month-label">{MONTH_NAMES[parseInt(row.date.slice(5, 7)) - 1]}</td>
                        <td>{formatCurrency(row.payment)}</td>
                        <td className="negative">{formatCurrency(row.interest)}</td>
                        <td>{formatCurrency(row.principal)}</td>
                        <td>{formatCurrency(row.balance)}</td>
                      </tr>
                    ))}</>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Future stub */}
      <p className="mortgage-note mortgage-future-note">
        בקרוב: העלאת מסמך משכנתא ומילוי אוטומטי של פרטי המסלולים.
      </p>
    </div>
  )
}
