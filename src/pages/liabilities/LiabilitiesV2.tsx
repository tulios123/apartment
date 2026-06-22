import { useState } from 'react'
import { Bank, HandCoins, Scales, Plus, X, CaretDown, PencilSimple, Trash } from '@phosphor-icons/react'
import { useMortgageData, ensureMortgage, upsertMortgageTrack, deleteMortgageTrack } from '../../hooks/useMortgageData'
import { useLoansData, upsertLoan, deleteLoan } from '../../hooks/useLoansData'
import { monthlyPayment, trackSchedule } from '../../lib/mortgage'
import { loanBalance, loanMonthlyPayment, loanInterestToDate, loanEndDate } from '../../lib/loans'
import { MORTGAGE_TRACK_TYPES } from '../../lib/constants'
import { formatCurrency } from '../../lib/format'
import { useAuth } from '../../contexts/AuthContext'
import { SkeletonList } from '../../components/ui/Skeleton'
import { PageError } from '../../components/ui/EmptyState'
import type { MortgageTrack, Loan, TrackType, LoanRepaymentType } from '../../types'
import './liabilities-v2.css'

const TRACK_LABEL: Record<TrackType, string> = { prime: 'פריים', fixed_unlinked: 'קבועה לא צמודה', fixed_linked: 'קבועה צמודה', variable: 'משתנה' }
const TRACK_COLOR: Record<TrackType, string> = { prime: 'blue', fixed_unlinked: 'teal', fixed_linked: 'purple', variable: 'amber' }
const fmt = (v: number) => formatCurrency(v)
const yearOf = (d: string | null) => d ? new Date(d).getFullYear() : null

const emptyTrack = { track_type: 'prime' as TrackType, label: '', principal: '', annual_rate: '', term_months: '', grace_months: '0', start_date: new Date().toISOString().slice(0, 10) }
const emptyLoan = { repayment_type: 'monthly_fixed' as LoanRepaymentType, track_type: 'fixed_unlinked' as TrackType, label: '', lender: '', principal: '', annual_rate: '', term_months: '', grace_months: '0', start_date: new Date().toISOString().slice(0, 10) }

export default function LiabilitiesV2({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { mortgage, tracks, summary, loading: loadingM, error: errorM, refetch: refetchM } = useMortgageData()
  const { monthlyLoans, balloonLoans, summary: loansSummary, loading: loadingL, error: errorL, refetch: refetchL } = useLoansData()

  const [open, setOpen] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [kind, setKind] = useState<'mortgage' | 'loan'>('mortgage')
  const [editId, setEditId] = useState<string | null>(null)
  const [tForm, setTForm] = useState(emptyTrack)
  const [graceOn, setGraceOn] = useState(false)
  const [lForm, setLForm] = useState(emptyLoan)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const mortgageBalance = summary.currentBalance || 0
  const loanBal = loansSummary.monthlyBalance || 0
  const balloonBal = loansSummary.balloonOutstanding || 0
  const total = mortgageBalance + loanBal + balloonBal
  const monthly = (summary.monthlyPayment || 0) + (loansSummary.monthlyPayment || 0)
  const pct = (v: number) => total > 0 ? (v / total) * 100 : 0

  function trackStats(t: MortgageTrack) {
    const sched = trackSchedule(t)
    const lastPaid = [...sched].reverse().find(r => r.date <= today)
    const balance = lastPaid ? lastPaid.balance : t.principal
    const interestPaid = sched.filter(r => r.date <= today).reduce((s, r) => s + r.interest, 0)
    const interestLeft = sched.filter(r => r.date > today).reduce((s, r) => s + r.interest, 0)
    const endYear = sched.length ? yearOf(sched[sched.length - 1].date) : null
    const pay = monthlyPayment(t.principal, t.annual_rate, t.term_months, t.grace_months ?? 0)
    const paidPct = t.principal > 0 ? ((t.principal - balance) / t.principal) * 100 : 0
    return { balance, interestPaid, interestLeft, endYear, pay, paidPct }
  }

  function openAddMortgage() { setKind('mortgage'); setEditId(null); setTForm(emptyTrack); setGraceOn(false); setFormError(null); setDrawerOpen(true) }
  function openAddLoan() { setKind('loan'); setEditId(null); setLForm(emptyLoan); setGraceOn(false); setFormError(null); setDrawerOpen(true) }
  function editTrack(t: MortgageTrack) {
    setKind('mortgage'); setEditId(t.id); setFormError(null)
    setTForm({ track_type: t.track_type, label: t.label ?? '', principal: String(t.principal), annual_rate: String(t.annual_rate), term_months: String(t.term_months), grace_months: String(t.grace_months ?? 0), start_date: t.start_date })
    setGraceOn((t.grace_months ?? 0) > 0)
    setDrawerOpen(true)
  }
  function editLoan(l: Loan) {
    setKind('loan'); setEditId(l.id); setFormError(null)
    setLForm({ repayment_type: l.repayment_type, track_type: l.track_type ?? 'fixed_unlinked', label: l.label ?? '', lender: l.lender ?? '', principal: String(l.principal), annual_rate: l.annual_rate != null ? String(l.annual_rate) : '', term_months: l.term_months != null ? String(l.term_months) : '', grace_months: String(l.grace_months ?? 0), start_date: l.start_date ?? new Date().toISOString().slice(0, 10) })
    setGraceOn((l.grace_months ?? 0) > 0)
    setDrawerOpen(true)
  }

  async function save() {
    if (!user) return
    setSaving(true); setFormError(null)
    try {
      if (kind === 'mortgage') {
        if (!tForm.principal || Number(tForm.principal) <= 0) throw new Error('יש להזין קרן תקינה')
        const mortgageId = mortgage?.id ?? (await ensureMortgage(user.id)).id
        await upsertMortgageTrack({
          id: editId ?? undefined, mortgage_id: mortgageId, owner_id: user.id,
          label: tForm.label || null, track_type: tForm.track_type,
          principal: Number(tForm.principal), annual_rate: Number(tForm.annual_rate || 0),
          term_months: Number(tForm.term_months || 0), grace_months: graceOn ? Number(tForm.grace_months || 0) : 0, start_date: tForm.start_date,
        })
        refetchM()
      } else {
        if (!lForm.principal || Number(lForm.principal) <= 0) throw new Error('יש להזין קרן תקינה')
        const isMonthly = lForm.repayment_type === 'monthly_fixed'
        await upsertLoan({
          id: editId ?? undefined, owner_id: user.id, label: lForm.label || null, lender: lForm.lender || null,
          repayment_type: lForm.repayment_type, track_type: isMonthly ? lForm.track_type : null,
          principal: Number(lForm.principal),
          annual_rate: isMonthly ? Number(lForm.annual_rate || 0) : null,
          term_months: isMonthly ? Number(lForm.term_months || 0) : null,
          grace_months: isMonthly && graceOn ? Number(lForm.grace_months || 0) : 0, start_date: lForm.start_date,
        })
        refetchL()
      }
      setDrawerOpen(false)
    } catch (e) { setFormError(e instanceof Error ? e.message : 'שגיאה בשמירה') }
    setSaving(false)
  }

  async function removeTrack(id: string) { await deleteMortgageTrack(id); refetchM() }
  async function removeLoan(id: string) { await deleteLoan(id); refetchL() }

  if (errorM || errorL) return <PageError message={errorM || errorL || 'שגיאה'} />

  return (
    <div className={embedded ? 'liav liav-embedded' : 'page liav'}>
      {!embedded && <div className="page-header"><h1>התחייבויות</h1></div>}

      {(loadingM || loadingL) ? <SkeletonList rows={4} /> : (
        <>
          <div className={`liav-hero${embedded ? ' slim' : ''}`}>
            {!embedded && (
              <>
                <div className="liav-hero-label">סך התחייבויות</div>
                <div className="liav-hero-value">{fmt(total)}</div>
                <div className="liav-comp-bar">
                  {mortgageBalance > 0 && <div className="mortgage" style={{ width: `${pct(mortgageBalance)}%` }} />}
                  {loanBal > 0 && <div className="loan" style={{ width: `${pct(loanBal)}%` }} />}
                  {balloonBal > 0 && <div className="balloon" style={{ width: `${pct(balloonBal)}%` }} />}
                </div>
                <div className="liav-comp-legend">
                  {mortgageBalance > 0 && <span><i className="liav-comp-dot" style={{ background: '#5aa0ec' }} /> משכנתא {fmt(mortgageBalance)}</span>}
                  {loanBal > 0 && <span><i className="liav-comp-dot" style={{ background: 'var(--accent-teal)' }} /> הלוואה {fmt(loanBal)}</span>}
                  {balloonBal > 0 && <span><i className="liav-comp-dot" style={{ background: '#f0b24e' }} /> בלון {fmt(balloonBal)}</span>}
                </div>
              </>
            )}
            <div className="liav-hero-foot">
              <div><span>תשלום חודשי</span><strong>{fmt(monthly)}</strong></div>
              <div><span>ריבית שנותרה לתשלום</span><strong>{fmt(Math.max(0, summary.totalInterestLife - summary.interestPaidToDate))}</strong></div>
            </div>
          </div>

          <section className="liav-section">
              <div className="liav-section-head"><Bank size={18} weight="duotone" color="var(--brand-navy)" /><h2>תמהיל המשכנתא</h2>{tracks.length > 0 && <span className="count">· {tracks.length} מסלולים</span>}</div>
              {tracks.map(t => {
                const s = trackStats(t); const color = TRACK_COLOR[t.track_type]; const isOpen = open === t.id
                return (
                  <div key={t.id} className={`liav-card${isOpen ? ' open' : ''}`}>
                    <button className="liav-card-head" onClick={() => setOpen(isOpen ? null : t.id)}>
                      <span className={`liav-badge ${color}`}>{TRACK_LABEL[t.track_type]}</span>
                      <div className="liav-card-main"><div className="liav-card-title">{fmt(s.pay)} לחודש</div><div className="liav-card-sub">ריבית {t.annual_rate.toFixed(1)}%{s.endYear ? ` · עד ${s.endYear}` : ''}{t.label ? ` · ${t.label}` : ''}</div></div>
                      <div className="liav-card-balance"><b>{fmt(s.balance)}</b><span>יתרה</span></div>
                      <CaretDown className="liav-card-caret" size={16} weight="bold" />
                    </button>
                    <div className="liav-progress"><div className="liav-progress-track"><div className={`liav-progress-fill ${color}`} style={{ width: `${s.paidPct}%` }} /></div><div className="liav-progress-labels"><span>נפרעו {Math.round(s.paidPct)}%</span><span>מתוך {fmt(t.principal)}</span></div></div>
                    <div className="liav-detail"><div className="liav-detail-inner">
                      <div className="liav-detail-grid">
                        <div className="liav-detail-item"><span>קרן מקורית</span><strong>{fmt(t.principal)}</strong></div>
                        <div className="liav-detail-item"><span>תקופה</span><strong>{Math.round(t.term_months / 12)} שנים</strong></div>
                        <div className="liav-detail-item"><span>ריבית ששולמה</span><strong className="interest">{fmt(s.interestPaid)}</strong></div>
                        <div className="liav-detail-item"><span>ריבית שנותרה</span><strong className="interest">{fmt(s.interestLeft)}</strong></div>
                        {(t.grace_months ?? 0) > 0 && <div className="liav-detail-item"><span>גרייס</span><strong>{t.grace_months} חודשים</strong></div>}
                      </div>
                      <div className="liav-detail-actions">
                        <button className="liav-detail-btn" onClick={() => editTrack(t)}><PencilSimple size={14} /> עריכה</button>
                        <button className="liav-detail-btn danger" onClick={() => removeTrack(t.id)}><Trash size={14} /> מחיקה</button>
                      </div>
                    </div></div>
                  </div>
                )
              })}
              <button className="liav-add-track" onClick={openAddMortgage}><Plus size={15} weight="bold" /> הוסף מסלול משכנתא</button>
            </section>

          <section className="liav-section">
              <div className="liav-section-head"><HandCoins size={18} weight="duotone" color="var(--brand-navy)" /><h2>הלוואות</h2></div>
              {monthlyLoans.map(l => {
                const bal = loanBalance(l); const isOpen = open === l.id
                const paidPct = l.principal > 0 ? ((l.principal - bal) / l.principal) * 100 : 0
                return (
                  <div key={l.id} className={`liav-card${isOpen ? ' open' : ''}`}>
                    <button className="liav-card-head" onClick={() => setOpen(isOpen ? null : l.id)}>
                      <span className={`liav-badge ${l.track_type ? TRACK_COLOR[l.track_type] : 'teal'}`}>{l.track_type ? TRACK_LABEL[l.track_type] : 'שפיצר'}</span>
                      <div className="liav-card-main"><div className="liav-card-title">{l.label || 'הלוואה'}</div><div className="liav-card-sub">{[l.lender, `${fmt(loanMonthlyPayment(l))} לחודש`, l.annual_rate != null ? `${l.annual_rate.toFixed(1)}%` : null].filter(Boolean).join(' · ')}</div></div>
                      <div className="liav-card-balance"><b>{fmt(bal)}</b><span>יתרה</span></div>
                      <CaretDown className="liav-card-caret" size={16} weight="bold" />
                    </button>
                    <div className="liav-progress"><div className="liav-progress-track"><div className="liav-progress-fill teal" style={{ width: `${paidPct}%` }} /></div><div className="liav-progress-labels"><span>נפרעו {Math.round(paidPct)}%</span><span>{loanEndDate(l) ? `עד ${yearOf(loanEndDate(l))}` : ''}</span></div></div>
                    <div className="liav-detail"><div className="liav-detail-inner">
                      <div className="liav-detail-grid">
                        <div className="liav-detail-item"><span>קרן מקורית</span><strong>{fmt(l.principal)}</strong></div>
                        <div className="liav-detail-item"><span>תקופה</span><strong>{l.term_months ? `${Math.round(l.term_months / 12)} שנים` : '—'}</strong></div>
                        <div className="liav-detail-item"><span>ריבית ששולמה</span><strong className="interest">{fmt(loanInterestToDate(l))}</strong></div>
                      </div>
                      <div className="liav-detail-actions">
                        <button className="liav-detail-btn" onClick={() => editLoan(l)}><PencilSimple size={14} /> עריכה</button>
                        <button className="liav-detail-btn danger" onClick={() => removeLoan(l.id)}><Trash size={14} /> מחיקה</button>
                      </div>
                    </div></div>
                  </div>
                )
              })}
              {balloonLoans.map(l => (
                <div key={l.id} className="liav-balloon">
                  <div className="liav-balloon-top">
                    <div className="liav-balloon-icon"><Scales size={20} weight="duotone" /></div>
                    <div className="liav-balloon-main"><div className="liav-balloon-title">{l.label || 'הלוואת בלון'}{l.lender ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {l.lender}</span> : null}</div></div>
                    <div className="liav-balloon-amount">{fmt(l.principal)}</div>
                    <button className="liav-detail-btn" style={{ marginRight: 8 }} onClick={() => editLoan(l)}><PencilSimple size={14} /></button>
                    <button className="liav-detail-btn danger" onClick={() => removeLoan(l.id)}><Trash size={14} /></button>
                  </div>
                  <div className="liav-balloon-note">בלון · נפרע במכירת הנכס · ללא תשלום חודשי</div>
                </div>
              ))}
              <button className="liav-add-track" onClick={openAddLoan}><Plus size={15} weight="bold" /> הוסף הלוואה</button>
            </section>
        </>
      )}

      <div className={`liav-scrim ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`liav-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="liav-drawer-head"><h2>{editId ? (kind === 'mortgage' ? 'עריכת מסלול' : 'עריכת הלוואה') : (kind === 'mortgage' ? 'הוספת מסלול משכנתא' : 'הוספת הלוואה')}</h2><button onClick={() => setDrawerOpen(false)} aria-label="סגור"><X size={20} /></button></div>

        {kind === 'mortgage' ? (
          <>
            <label className="liav-field"><span>סוג מסלול</span><select value={tForm.track_type} onChange={e => setTForm(f => ({ ...f, track_type: e.target.value as TrackType }))}>{MORTGAGE_TRACK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            <div className="liav-row2">
              <label className="liav-field"><span>קרן ₪</span><input type="number" value={tForm.principal} onChange={e => setTForm(f => ({ ...f, principal: e.target.value }))} autoFocus={drawerOpen} /></label>
              <label className="liav-field"><span>ריבית %</span><input type="number" step="0.01" value={tForm.annual_rate} onChange={e => setTForm(f => ({ ...f, annual_rate: e.target.value }))} /></label>
            </div>
            <div className="liav-row2">
              <label className="liav-field"><span>תקופה (חודשים)</span><input type="number" value={tForm.term_months} onChange={e => setTForm(f => ({ ...f, term_months: e.target.value }))} /></label>
              {graceOn
                ? <label className="liav-field"><span>גרייס (חודשים)</span><input type="number" min="0" value={tForm.grace_months} onChange={e => setTForm(f => ({ ...f, grace_months: e.target.value }))} /></label>
                : <div className="liav-field" />}
            </div>
            <label className="liav-grace-toggle">
              <input type="checkbox" checked={graceOn} onChange={e => { setGraceOn(e.target.checked); if (e.target.checked && !Number(tForm.grace_months)) setTForm(f => ({ ...f, grace_months: '1' })) }} />
              <span>תקופת גרייס</span>
            </label>
            <label className="liav-field"><span>תאריך התחלה</span><input type="date" value={tForm.start_date} onChange={e => setTForm(f => ({ ...f, start_date: e.target.value }))} /></label>
            <label className="liav-field"><span>תווית (אופציונלי)</span><input type="text" value={tForm.label} onChange={e => setTForm(f => ({ ...f, label: e.target.value }))} /></label>
          </>
        ) : (
          <>
            <label className="liav-field"><span>סוג החזר</span><select value={lForm.repayment_type} onChange={e => setLForm(f => ({ ...f, repayment_type: e.target.value as LoanRepaymentType }))}><option value="monthly_fixed">שפיצר (חודשי קבוע)</option><option value="balloon">בלון (נפרע במכירה)</option></select></label>
            {lForm.repayment_type === 'monthly_fixed' && (
              <label className="liav-field"><span>סוג מסלול</span><select value={lForm.track_type} onChange={e => setLForm(f => ({ ...f, track_type: e.target.value as TrackType }))}>{MORTGAGE_TRACK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            )}
            <div className="liav-row2">
              <label className="liav-field"><span>קרן ₪</span><input type="number" value={lForm.principal} onChange={e => setLForm(f => ({ ...f, principal: e.target.value }))} autoFocus={drawerOpen} /></label>
              <label className="liav-field"><span>מלווה</span><input type="text" value={lForm.lender} onChange={e => setLForm(f => ({ ...f, lender: e.target.value }))} /></label>
            </div>
            {lForm.repayment_type === 'monthly_fixed' && (
              <>
                <div className="liav-row2">
                  <label className="liav-field"><span>ריבית %</span><input type="number" step="0.01" value={lForm.annual_rate} onChange={e => setLForm(f => ({ ...f, annual_rate: e.target.value }))} /></label>
                  <label className="liav-field"><span>תקופה (חודשים)</span><input type="number" value={lForm.term_months} onChange={e => setLForm(f => ({ ...f, term_months: e.target.value }))} /></label>
                </div>
                <div className="liav-row2">
                  {graceOn
                    ? <label className="liav-field"><span>גרייס (חודשים)</span><input type="number" min="0" value={lForm.grace_months} onChange={e => setLForm(f => ({ ...f, grace_months: e.target.value }))} /></label>
                    : <div className="liav-field" />}
                  <div className="liav-field" />
                </div>
                <label className="liav-grace-toggle">
                  <input type="checkbox" checked={graceOn} onChange={e => { setGraceOn(e.target.checked); if (e.target.checked && !Number(lForm.grace_months)) setLForm(f => ({ ...f, grace_months: '1' })) }} />
                  <span>תקופת גרייס</span>
                </label>
              </>
            )}
            <label className="liav-field"><span>תאריך התחלה</span><input type="date" value={lForm.start_date} onChange={e => setLForm(f => ({ ...f, start_date: e.target.value }))} /></label>
            <label className="liav-field"><span>תווית (אופציונלי)</span><input type="text" value={lForm.label} onChange={e => setLForm(f => ({ ...f, label: e.target.value }))} /></label>
          </>
        )}
        {formError && <div className="liav-form-err" role="alert">{formError}</div>}
        <button className="liav-save" disabled={saving} onClick={save}>{saving ? 'שומר…' : 'שמירה'}</button>
      </aside>
    </div>
  )
}
