import { useState } from 'react'
import { Check, WarningCircle, CaretDown, CaretUp, LockSimple, CircleNotch, X, CheckCircle } from '@phosphor-icons/react'
import { MORTGAGE_TRACK_TYPES } from '../../lib/constants'
import { formatCurrency, formatNum } from '../../lib/format'
import type { TrackType, LoanRepaymentType } from '../../types'
import { DateField } from '../../components/ui/DateField'

export type TrackDraft = { track_type: TrackType; label: string; principal: string; annual_rate: string; term_months: string; grace_months: string; start_date: string }
export type LoanDraft = { repayment_type: LoanRepaymentType; track_type: TrackType; label: string; lender: string; principal: string; annual_rate: string; prime_rate: string; margin: string; term_months: string; grace_months: string; start_date: string }
export type ScanDraft = TrackDraft | LoanDraft

const TRACK_LABEL: Record<TrackType, string> = { prime: 'פריים', fixed_unlinked: 'קבועה לא צמודה', fixed_linked: 'קבועה צמודה', variable: 'משתנה' }

const num = (s: string) => Number(s) || 0

// Missing OR suspicious required fields — drives each row's badge and the gate.
// A rate/term of 0 counts as "needs check", not only an empty field.
function issues(kind: 'mortgage' | 'loan', d: ScanDraft): string[] {
  const out: string[] = []
  if (num(d.principal) <= 0) out.push('סכום')
  const monthly = kind === 'mortgage' || (d as LoanDraft).repayment_type === 'monthly_fixed'
  if (monthly) {
    if (num(d.term_months) <= 0) out.push('תקופה')
    if (num(d.annual_rate) <= 0) out.push('ריבית')
  }
  return out
}

function rowTitle(kind: 'mortgage' | 'loan', d: ScanDraft): string {
  if (kind === 'mortgage') return TRACK_LABEL[(d as TrackDraft).track_type]
  const l = d as LoanDraft
  return l.label || l.lender || 'הלוואה'
}
function rowSub(kind: 'mortgage' | 'loan', d: ScanDraft): string {
  const parts: string[] = []
  if (num(d.principal) > 0) parts.push(formatCurrency(num(d.principal)))
  const balloon = kind === 'loan' && (d as LoanDraft).repayment_type === 'balloon'
  if (balloon) { parts.push('בלון'); return parts.join(' · ') }
  if (num(d.term_months) > 0) parts.push(`${Math.round(num(d.term_months) / 12)} שנה`)
  if (num(d.annual_rate) > 0) parts.push(`${num(d.annual_rate)}%`)
  return parts.join(' · ')
}

/**
 * Smart review card for an AI document scan. Each detected track/loan is a row with
 * a completeness badge (✓ מלא / ⚠ חסר X); a row expands inline to edit its fields
 * (the missing/suspicious ones highlighted amber). The add button is gated until
 * every row is complete — tapping it while incomplete jumps to the first problem —
 * so a partial mortgage can never slip in.
 */
export function ScanReview({ kind, initial, saving, demo, onConfirm, onCancel }: {
  kind: 'mortgage' | 'loan'
  initial: ScanDraft[]
  saving: boolean
  demo: boolean
  onConfirm: (drafts: ScanDraft[]) => void
  onCancel: () => void
}) {
  const [drafts, setDrafts] = useState<ScanDraft[]>(initial)
  const firstBad = drafts.findIndex(d => issues(kind, d).length > 0)
  const [openIdx, setOpenIdx] = useState<number | null>(firstBad >= 0 ? firstBad : null)

  const noun = kind === 'mortgage' ? 'מסלול' : 'הלוואה'
  const nounPl = kind === 'mortgage' ? 'מסלולים' : 'הלוואות'
  const total = drafts.reduce((s, d) => s + num(d.principal), 0)
  const badCount = drafts.filter(d => issues(kind, d).length > 0).length
  const allOk = badCount === 0

  const set = (i: number, key: string, val: string) =>
    setDrafts(ds => ds.map((d, j) => (j === i ? ({ ...d, [key]: val } as ScanDraft) : d)))

  function confirm() {
    if (saving) return
    if (!allOk) { setOpenIdx(drafts.findIndex(d => issues(kind, d).length > 0)); return }
    onConfirm(drafts)
  }

  return (
    <div className="liav-scan-summary">
      <button className="liav-scan-summary-x" onClick={onCancel} aria-label="סגור"><X size={16} /></button>
      <div className="liav-scan-summary-head">
        <CheckCircle size={24} weight="fill" />
        <div>
          <div className="liav-scan-summary-title">קראתי את המסמך</div>
          <div className="liav-scan-summary-sub">
            {drafts.length} {drafts.length === 1 ? noun : nounPl} · סך {formatCurrency(total)}
          </div>
        </div>
      </div>
      {demo && <div className="liav-scan-summary-demo">מצב מנהל · נתוני דמו (לא נקרא דרך AI)</div>}

      <div className="liav-rev-list">
        {drafts.map((d, i) => {
          const probs = issues(kind, d)
          const ok = probs.length === 0
          const open = openIdx === i
          const warn = (field: 'principal' | 'term_months' | 'annual_rate') => num(d[field]) <= 0
          return (
            <div key={i} className={`liav-rev-row${ok ? '' : ' bad'}${open ? ' open' : ''}`}>
              <button type="button" className="liav-rev-head" onClick={() => setOpenIdx(open ? null : i)}>
                <span className={`liav-rev-badge ${ok ? 'ok' : 'warn'}`}>
                  {ok ? <Check size={13} weight="bold" /> : <WarningCircle size={13} weight="fill" />}
                  {ok ? 'מלא' : `חסר ${probs[0]}${probs.length > 1 ? ` +${probs.length - 1}` : ''}`}
                </span>
                <span className="liav-rev-main">
                  <span className="liav-rev-title">{rowTitle(kind, d)}</span>
                  <span className="liav-rev-sub">{rowSub(kind, d)}</span>
                </span>
                {open ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
              </button>

              {open && (
                <div className="liav-rev-form">
                  {kind === 'mortgage' ? (
                    <label className="liav-field"><span>סוג מסלול</span>
                      <select value={(d as TrackDraft).track_type} onChange={e => set(i, 'track_type', e.target.value)}>
                        {MORTGAGE_TRACK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label className="liav-field"><span>סוג החזר</span>
                      <select value={(d as LoanDraft).repayment_type} onChange={e => set(i, 'repayment_type', e.target.value)}>
                        <option value="monthly_fixed">שפיצר (חודשי קבוע)</option>
                        <option value="balloon">בלון (נפרע במכירה)</option>
                      </select>
                    </label>
                  )}

                  <div className="liav-row2">
                    <label className={`liav-field${warn('principal') ? ' liav-field-warn' : ''}`}><span>קרן ₪</span>
                      <input type="text" inputMode="numeric" value={formatNum(d.principal)} onChange={e => set(i, 'principal', e.target.value.replace(/[^\d]/g, ''))} />
                    </label>
                    {kind === 'loan'
                      ? <label className="liav-field"><span>מלווה</span><input type="text" value={(d as LoanDraft).lender} onChange={e => set(i, 'lender', e.target.value)} /></label>
                      : <label className={`liav-field${warn('annual_rate') ? ' liav-field-warn' : ''}`}><span>ריבית %</span><input type="number" step="0.01" value={d.annual_rate} onChange={e => set(i, 'annual_rate', e.target.value)} placeholder="הקלידו ריבית" /></label>}
                  </div>

                  {(kind === 'mortgage' || (d as LoanDraft).repayment_type === 'monthly_fixed') && (
                    <div className="liav-row2">
                      <label className={`liav-field${warn('term_months') ? ' liav-field-warn' : ''}`}><span>תקופה (חודשים)</span>
                        <input type="number" value={d.term_months} onChange={e => set(i, 'term_months', e.target.value)} placeholder="הקלידו תקופה" />
                      </label>
                      {kind === 'loan'
                        ? <label className={`liav-field${warn('annual_rate') ? ' liav-field-warn' : ''}`}><span>ריבית %</span><input type="number" step="0.01" value={d.annual_rate} onChange={e => set(i, 'annual_rate', e.target.value)} placeholder="הקלידו ריבית" /></label>
                        : <label className="liav-field"><span>תאריך התחלה</span><DateField value={d.start_date} onChange={v => set(i, 'start_date', v)} ariaLabel="תאריך התחלה" /></label>}
                    </div>
                  )}

                  {!ok && (
                    <div className="liav-rev-hint">
                      <WarningCircle size={14} weight="fill" /> חסר {probs.join(' · ')} — השלימו כדי להוסיף.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className={`liav-rev-cta${allOk ? '' : ' gated'}`} onClick={confirm} disabled={saving}>
        {saving ? <CircleNotch className="spin" size={18} weight="bold" /> : (!allOk && <LockSimple size={16} weight="bold" />)}
        {saving ? 'מוסיף…'
          : allOk ? (kind === 'mortgage' ? `הוסיפו את המשכנתא (${drafts.length} ${drafts.length === 1 ? noun : nounPl})` : `הוסיפו ${drafts.length === 1 ? 'הלוואה' : 'הלוואות'} (${drafts.length})`)
          : `השלימו ${badCount} ${badCount === 1 ? noun : nounPl} כדי להוסיף`}
      </button>
    </div>
  )
}
