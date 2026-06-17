import { PencilSimple } from '@phosphor-icons/react'
import { ClayIllustration } from '../components/ui/ClayIllustration'
import { useState, useMemo, Fragment } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useMortgageData,
  ensureMortgage,
  upsertMortgageTrack,
  deleteMortgageTrack,
} from '../hooks/useMortgageData'
import { monthlyPayment, trackSchedule, gracePeriodPayment } from '../lib/mortgage'
import { MORTGAGE_TRACK_TYPES } from '../lib/constants'
import { formatCurrency, formatDate, formatNum } from '../lib/format'
import type { MortgageTrack, TrackType } from '../types'
import type { ScheduleRow } from '../lib/mortgage'
import { SkeletonStats, SkeletonList } from '../components/ui/Skeleton'
import { PageError } from '../components/ui/EmptyState'
import { Sparkline } from '../components/ui/Sparkline'
import { BarChart } from '../components/ui/BarChart'

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
  const isAnchored = t.track_type === 'prime' || t.track_type === 'variable'
  // Prefer the stored prime/margin split; fall back for legacy rows saved
  // before those columns existed (effective rate in prime, zero margin).
  const hasSplit = t.prime_rate != null || t.margin != null
  return {
    id: t.id,
    label: t.label ?? '',
    track_type: t.track_type as TrackType,
    principal: String(Math.round(t.principal)),
    annual_rate: isAnchored ? '' : t.annual_rate.toFixed(3),
    prime_rate: isAnchored ? (hasSplit ? (t.prime_rate ?? 0).toFixed(3) : t.annual_rate.toFixed(3)) : '',
    margin: isAnchored ? (hasSplit ? (t.margin ?? 0).toFixed(3) : '0') : '',
    term_months: String(t.term_months),
    grace_months: t.grace_months ? String(t.grace_months) : '',
    start_date: t.start_date,
  }
}

function effectiveRate(form: TrackForm): number {
  if (form.track_type === 'prime' || form.track_type === 'variable') {
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

  // "Add" form — only used for new tracks now (existing tracks are inline-edited)
  const [form, setForm] = useState<TrackForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  // graceEdit: just trackId + months (no enabled boolean — presence = active)
  const [graceEdit, setGraceEdit] = useState<{ trackId: string; months: string } | null>(null)
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())
  const [scheduleTrackFilter, setScheduleTrackFilter] = useState<string>('all')
  // Single edit-mode toggle for track management
  const [editMode, setEditMode] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)

  // Inline draft state: keyed by track.id, seeded from formFromTrack on first edit
  const [drafts, setDrafts] = useState<Record<string, TrackForm>>({})
  // Per-track save error
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({})
  // Delete confirmation: which track is pending
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const yearRows = useMemo(() => {
    if (scheduleTrackFilter === 'all') return groupByYear(combined)
    const filtered = tracks.find(t => t.id === scheduleTrackFilter)
    if (!filtered) return []
    return groupByYear(trackSchedule(filtered))
  }, [combined, scheduleTrackFilter, tracks])

  function toggleYear(y: number) {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(y)) next.delete(y)
      else next.add(y)
      return next
    })
  }

  // Seed draft for a track if not already seeded
  function getDraft(track: MortgageTrack): TrackForm {
    return drafts[track.id] ?? formFromTrack(track)
  }

  function setDraftField<K extends keyof TrackForm>(
    trackId: string,
    track: MortgageTrack,
    key: K,
    val: TrackForm[K],
  ) {
    setDrafts(prev => {
      const base = prev[trackId] ?? formFromTrack(track)
      return { ...prev, [trackId]: { ...base, [key]: val } }
    })
  }

  async function handleBlurSave(track: MortgageTrack) {
    const draft = drafts[track.id]
    if (!draft || !user) return
    // Validate minimums
    const principal = parseFloat(draft.principal) || 0
    const termMonths = parseInt(draft.term_months) || 0
    if (principal <= 0 || termMonths <= 0) return // invalid — don't save
    try {
      const mortgageRow = mortgage ?? await ensureMortgage(user.id)
      const rate = effectiveRate(draft)
      const isAnchored = draft.track_type === 'prime' || draft.track_type === 'variable'
      await upsertMortgageTrack({
        id: track.id,
        mortgage_id: mortgageRow.id,
        owner_id: user.id,
        label: draft.label.trim() || null,
        track_type: draft.track_type,
        principal,
        annual_rate: rate,
        prime_rate: isAnchored ? (parseFloat(draft.prime_rate) || 0) : null,
        margin: isAnchored ? (parseFloat(draft.margin) || 0) : null,
        term_months: termMonths,
        grace_months: parseInt(draft.grace_months) || 0,
        start_date: draft.start_date,
      })
      // Clear any prior error for this track
      setDraftErrors(prev => { const next = { ...prev }; delete next[track.id]; return next })
      await refetch()
    } catch (e) {
      setDraftErrors(prev => ({ ...prev, [track.id]: e instanceof Error ? e.message : 'שגיאה בשמירה' }))
    }
  }

  // Add-form helpers (only for new tracks)
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
      const isAnchored = form.track_type === 'prime' || form.track_type === 'variable'
      await upsertMortgageTrack({
        id: form.id,
        mortgage_id: mortgageRow.id,
        owner_id: user.id,
        label: form.label.trim() || null,
        track_type: form.track_type,
        principal: parseFloat(form.principal) || 0,
        annual_rate: rate,
        prime_rate: isAnchored ? (parseFloat(form.prime_rate) || 0) : null,
        margin: isAnchored ? (parseFloat(form.margin) || 0) : null,
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
    try {
      await deleteMortgageTrack(id)
      setConfirmDeleteId(null)
      await refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'שגיאה')
    }
  }

  async function saveGrace(track: MortgageTrack, overrideMonths?: number) {
    if (!graceEdit || !user) return
    const grace = overrideMonths !== undefined ? overrideMonths : (parseInt(graceEdit.months) || 0)
    try {
      await upsertMortgageTrack({
        id: track.id,
        mortgage_id: track.mortgage_id,
        owner_id: user.id,
        label: track.label,
        track_type: track.track_type,
        principal: track.principal,
        annual_rate: track.annual_rate,
        prime_rate: track.prime_rate,
        margin: track.margin,
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

  if (loading) return (
    <div className="page mortgage-page">
      <SkeletonStats count={3} />
      <SkeletonList rows={3} />
    </div>
  )
  if (error) return <PageError message={error} onRetry={refetch} />

  if (tracks.length === 0 && !form) {
    return (
      <div className="empty-state-cta">
        <div className="empty-state-cta-icon"><ClayIllustration variant="bank" /></div>
        <p>עדיין לא הוספת משכנתא</p>
        <button className="btn-primary" onClick={() => setForm(emptyForm())}>+ הוסף מסלול משכנתא</button>
      </div>
    )
  }

  const preview = form ? previewPayment(form) : 0
  const effectiveRateVal = form ? effectiveRate(form) : 0

  const hasGrace = tracks.some(t => (t.grace_months ?? 0) > 0)
  const gracePeriodPaymentAmount = gracePeriodPayment(tracks)

  return (
    <div className="mortgage-page">
      {/* ── Summary cards ── */}
      <div className="summary-cards mortgage-summary-cards">
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
                <span className="summary-amount">{formatCurrency(gracePeriodPaymentAmount)}</span>
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
          {editMode ? (
            <button
              className="btn-secondary"
              onClick={() => {
                setEditMode(false)
                setForm(null)
                setGraceEdit(null)
                setDrafts({})
                setDraftErrors({})
                setConfirmDeleteId(null)
              }}
            >
              סיום
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => {
              setEditMode(true)
              // Seed drafts from current tracks
              const seeded: Record<string, TrackForm> = {}
              tracks.forEach(t => { seeded[t.id] = formFromTrack(t) })
              setDrafts(seeded)
            }}>
              ערוך
            </button>
          )}
        </div>

        {tracks.length === 0 && !form && (
          <div className="empty-state">אין מסלולים. הוסף מסלול ראשון.</div>
        )}

        {/* Existing tracks */}
        {tracks.map(track => {
          const draft = getDraft(track)
          const isAnchored = draft.track_type === 'prime' || draft.track_type === 'variable'
          const livePayment = editMode
            ? previewPayment(draft)
            : monthlyPayment(track.principal, track.annual_rate, track.term_months, track.grace_months ?? 0)
          const isPendingDelete = confirmDeleteId === track.id

          return (
            <div key={track.id} className="prop-card mortgage-track-card">
              {editMode ? (
                /* ── EDIT MODE: inline editable card ── */
                <div className="mortgage-inline-edit">
                  {/* Top row: delete control (top-left in RTL = margin-left: auto) */}
                  <div className="mortgage-inline-edit-top">
                    {isPendingDelete ? (
                      <span className="mortgage-delete-confirm">
                        <span className="mortgage-delete-confirm-label">למחוק?</span>
                        <button
                          className="btn-xs btn-danger-solid"
                          onClick={() => handleDelete(track.id)}
                        >
                          מחק
                        </button>
                        <button
                          className="btn-xs btn-secondary"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          ביטול
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn-icon danger mortgage-delete-btn"
                        onClick={() => setConfirmDeleteId(track.id)}
                        title="מחק מסלול"
                        aria-label="מחק מסלול"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Field grid */}
                  <div className="mortgage-inline-fields">
                    {/* Row 1: track type + label */}
                    <div className="mortgage-inline-row">
                      <div className="mortgage-inline-field">
                        <label className="mortgage-inline-label">סוג מסלול</label>
                        <select
                          className="form-input mortgage-inline-select"
                          value={draft.track_type}
                          onChange={e => setDraftField(track.id, track, 'track_type', e.target.value as TrackType)}
                          onBlur={() => handleBlurSave(track)}
                        >
                          {MORTGAGE_TRACK_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mortgage-inline-field">
                        <label className="mortgage-inline-label">תיאור</label>
                        <input
                          type="text"
                          className="form-input"
                          value={draft.label}
                          onChange={e => setDraftField(track.id, track, 'label', e.target.value)}
                          onBlur={() => handleBlurSave(track)}
                          placeholder="למשל: מסלול פריים"
                        />
                      </div>
                    </div>

                    {/* Row 2: principal + term */}
                    <div className="mortgage-inline-row">
                      <div className="mortgage-inline-field">
                        <label className="mortgage-inline-label">קרן (₪)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          value={formatNum(draft.principal)}
                          onChange={e => setDraftField(track.id, track, 'principal', e.target.value.replace(/[^\d]/g, ''))}
                          onBlur={() => handleBlurSave(track)}
                          placeholder="1,000,000"
                        />
                      </div>
                      <div className="mortgage-inline-field">
                        <label className="mortgage-inline-label">תקופה (חודשים)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={draft.term_months}
                          onChange={e => setDraftField(track.id, track, 'term_months', e.target.value)}
                          onBlur={() => handleBlurSave(track)}
                          placeholder="360"
                          min="1"
                          max="600"
                        />
                      </div>
                    </div>

                    {/* Row 3: rate fields — split for anchored types */}
                    {isAnchored ? (
                      <div className="mortgage-inline-row">
                        <div className="mortgage-inline-field">
                          <label className="mortgage-inline-label">
                            {draft.track_type === 'prime' ? 'ריבית פריים נוכחית (%)' : 'עוגן (%)'}
                          </label>
                          <input
                            type="number"
                            className="form-input"
                            value={draft.prime_rate}
                            onChange={e => setDraftField(track.id, track, 'prime_rate', e.target.value)}
                            onBlur={() => handleBlurSave(track)}
                            placeholder={draft.track_type === 'prime' ? '6.0' : '3.5'}
                            step="0.001"
                          />
                        </div>
                        <div className="mortgage-inline-field">
                          <label className="mortgage-inline-label">מרווח (%)</label>
                          <input
                            type="number"
                            className="form-input"
                            value={draft.margin}
                            onChange={e => setDraftField(track.id, track, 'margin', e.target.value)}
                            onBlur={() => handleBlurSave(track)}
                            placeholder={draft.track_type === 'prime' ? '-0.5' : '1.5'}
                            step="0.001"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mortgage-inline-row">
                        <div className="mortgage-inline-field">
                          <label className="mortgage-inline-label">ריבית שנתית (%)</label>
                          <input
                            type="number"
                            className="form-input"
                            value={draft.annual_rate}
                            onChange={e => setDraftField(track.id, track, 'annual_rate', e.target.value)}
                            onBlur={() => handleBlurSave(track)}
                            placeholder="5.250"
                            step="0.001"
                            min="0"
                          />
                        </div>
                        <div className="mortgage-inline-field">
                          <label className="mortgage-inline-label">תאריך התחלה</label>
                          <input
                            type="date"
                            className="form-input"
                            value={draft.start_date}
                            onChange={e => setDraftField(track.id, track, 'start_date', e.target.value)}
                            onBlur={() => handleBlurSave(track)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Extra row for anchored: start date */}
                    {isAnchored && (
                      <div className="mortgage-inline-row">
                        <div className="mortgage-inline-field">
                          <label className="mortgage-inline-label">תאריך התחלה</label>
                          <input
                            type="date"
                            className="form-input"
                            value={draft.start_date}
                            onChange={e => setDraftField(track.id, track, 'start_date', e.target.value)}
                            onBlur={() => handleBlurSave(track)}
                          />
                        </div>
                        <div className="mortgage-inline-field mortgage-inline-computed">
                          <label className="mortgage-inline-label">ריבית אפקטיבית</label>
                          <span className="mortgage-effective-rate-inline">
                            {effectiveRate(draft).toFixed(3)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Computed payment row */}
                    <div className="mortgage-inline-payment">
                      <span className="mortgage-inline-payment-label">תשלום חודשי (מחושב):</span>
                      <strong>{livePayment > 0 ? formatCurrency(livePayment) : '—'}</strong>
                    </div>
                  </div>

                  {/* Grace control — unchanged logic */}
                  <div className="mortgage-inline-grace">
                    {graceEdit?.trackId === track.id ? (
                      <span className="grace-inline-edit">
                        <span className="grace-months-label">חודשי גרייס</span>
                        <input
                          type="number"
                          className="grace-months-input"
                          value={graceEdit.months}
                          onChange={e => setGraceEdit(g => g ? { ...g, months: e.target.value } : g)}
                          min="0"
                          autoFocus
                        />
                        <span className="grace-inline-actions">
                          <button className="btn-primary btn-xs" onClick={() => saveGrace(track)}>שמור</button>
                          <button className="btn-secondary btn-xs" onClick={() => setGraceEdit(null)}>ביטול</button>
                          {(track.grace_months ?? 0) > 0 && (
                            <button
                              className="btn-xs btn-ghost-danger"
                              onClick={() => saveGrace(track, 0)}
                            >
                              הסר גרייס
                            </button>
                          )}
                        </span>
                      </span>
                    ) : (track.grace_months ?? 0) > 0 ? (
                      <span
                        className="grace-badge grace-badge-clickable"
                        onClick={() => setGraceEdit({ trackId: track.id, months: String(track.grace_months) })}
                      >
                        גרייס {track.grace_months} חודשים <PencilSimple size={13} />
                      </span>
                    ) : (
                      <span
                        className="grace-badge grace-badge-empty"
                        onClick={() => setGraceEdit({ trackId: track.id, months: '12' })}
                      >
                        + הוסף גרייס
                      </span>
                    )}
                  </div>

                  {/* Per-track save error */}
                  {draftErrors[track.id] && (
                    <div className="form-error mortgage-inline-error" role="alert">
                      {draftErrors[track.id]}
                    </div>
                  )}
                </div>
              ) : (
                /* ── VIEW MODE: read-only card ── */
                <div className="mortgage-track-row">
                  <div className="mortgage-track-info">
                    <span className="mortgage-track-type">
                      {MORTGAGE_TRACK_TYPES.find(t => t.value === track.track_type)?.label ?? track.track_type}
                    </span>
                    {track.label && <span className="mortgage-track-label">{track.label}</span>}
                    {(track.grace_months ?? 0) > 0 && (
                      <span className="grace-badge grace-badge-clickable grace-badge-readonly">
                        גרייס {track.grace_months} חודשים
                      </span>
                    )}
                  </div>
                  <div className="mortgage-track-numbers">
                    <span>קרן: <strong>{formatCurrency(track.principal)}</strong></span>
                    <span>ריבית: <strong>{track.annual_rate.toFixed(3)}%</strong></span>
                    <span>תקופה: <strong>{track.term_months} חודשים</strong></span>
                    <span>תשלום: <strong>{formatCurrency(livePayment)}</strong></span>
                  </div>
                  <div className="mortgage-track-meta">
                    <span>מתאריך {formatDate(track.start_date)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* "Add track" button — only in edit mode, after all track cards */}
        {editMode && !form && (
          <button className="btn-secondary mortgage-add-track-btn" onClick={() => setForm(emptyForm())}>
            + הוסף מסלול
          </button>
        )}

        {/* Add form — only for NEW tracks */}
        {form && (
          <div className="prop-card mortgage-form-card">
            <h3>מסלול חדש</h3>

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
                type="text"
                inputMode="numeric"
                className="form-input"
                value={formatNum(form.principal)}
                onChange={e => setField('principal', e.target.value.replace(/[^\d]/g, ''))}
                placeholder="1,000,000"
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

            {(form.track_type === 'prime' || form.track_type === 'variable') ? (
              <div className="form-2col">
                <div className="form-row">
                  <label>{form.track_type === 'prime' ? 'ריבית פריים נוכחית (%)' : 'עוגן (%)'}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.prime_rate}
                    onChange={e => setField('prime_rate', e.target.value)}
                    placeholder={form.track_type === 'prime' ? '6.0' : '3.5'}
                    step="0.001"
                  />
                </div>
                <div className="form-row">
                  <label>מרווח (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.margin}
                    onChange={e => setField('margin', e.target.value)}
                    placeholder={form.track_type === 'prime' ? '-0.5' : '1.5'}
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

            {(form.track_type === 'prime' || form.track_type === 'variable') && (
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

            {saveErr && <div className="form-error" role="alert">{saveErr}</div>}

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

      {/* ── Analytics ── */}
      {tracks.length > 0 && combined.length > 0 && (
        <section className="mortgage-analytics-section">
          <div className="mortgage-section-header">
            <h2>ניתוח משכנתא</h2>
          </div>

          {/* Balance over time */}
          <div className="chart-card">
            <div className="chart-card-title">יתרת המשכנתא לאורך זמן</div>
            <Sparkline
              data={combined.map(r => r.balance)}
              height={120}
              color="var(--accent)"
            />
            <div className="chart-labels">
              <span>{formatCurrency(summary.currentBalance)} יתרה נוכחית</span>
              <span>סה״כ קרן: {formatCurrency(summary.totalPrincipal)}</span>
            </div>
            <div className="chart-caption">
              עד לסיום ההלוואה היתרה תרד לאפס
            </div>
          </div>

          {/* Principal vs interest */}
          <div className="chart-card">
            <div className="chart-card-title">קרן מול ריבית — לאורך חיי ההלוואה</div>
            <BarChart
              data={[
                { label: 'קרן', value: summary.totalPrincipal, color: 'var(--accent)' },
                { label: 'ריבית', value: summary.totalInterestLife, color: 'var(--danger)' },
              ]}
              height={140}
              formatValue={formatCurrency}
            />
            <div className="chart-caption">
              עלות כוללת של ההלוואה: <strong>{formatCurrency(summary.totalPrincipal + summary.totalInterestLife)}</strong>
            </div>
          </div>
        </section>
      )}

      {/* ── Amortization schedule — collapsed by default ── */}
      {combined.length > 0 && (
        <section className="mortgage-schedule-section">
          <div className="mortgage-section-header">
            <h2>
              <button
                className="btn-link mortgage-schedule-toggle"
                onClick={() => setShowSchedule(s => !s)}
              >
                {showSchedule ? 'הסתר לוח סילוקין' : 'הצג לוח סילוקין'}
              </button>
            </h2>
            {showSchedule && tracks.length > 1 && (
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

          {showSchedule && (
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
                  <Fragment key={yr.year}>
                    <tr
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
                    ))}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}
        </section>
      )}

      {/* Future stub */}
      <p className="mortgage-note mortgage-future-note">
        בקרוב: העלאת מסמך משכנתא ומילוי אוטומטי של פרטי המסלולים.
      </p>
    </div>
  )
}
