import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bank, X, CaretDown } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { TrackForm } from './TrackForm'
import { FinishEarly } from './FinishEarly'
import { DocFileList } from './DocFileList'
import { emptyTrack, emptyLoan, formatCurrency } from './types'
import { useOnboarding } from './context'

export function MortgageStep() {
  const {
    advance, keyDeliveryDate, setLoanForm,
    mortgageAiBusy, mortgageDocRef, mortgageAiErr, mortgageAiDone, aiFillMortgage,
    mortgageDocFiles, removeDocFile, renameDocFile,
    tracks, setTracks, trackForm, trackMonthlyPayment, trackEffectiveRate, trackTypeLabel,
    editingIdx, setEditingIdx, setTrackForm, setGraceOn, showTrackForm, setShowTrackForm,
    addTrack, saveTrackEdit, saveCurrentAndOpenNew, removeTrack,
    setTrackGraceMonths, applyGraceToAllTracks, setGraceMonthsForActive,
    totalPrincipal, totalMonthly, hasAnyGrace, totalGraceMonthly,
    fillTestMortgage,
  } = useOnboarding()

  // Shared grace period for the top bar; grace itself lives on each track's grace_months.
  const [graceMonths, setGraceMonths] = useState(() => {
    const g = tracks.find(t => (parseInt(t.grace_months) || 0) > 0)
    return g ? g.grace_months : '12'
  })
  const anyGrace = tracks.some(t => (parseInt(t.grace_months) || 0) > 0)
  const [showDocs, setShowDocs] = useState(false)
  const [continuePrompt, setContinuePrompt] = useState(false)
  const [alertPulse, setAlertPulse] = useState(0)
  const [saveAttempted, setSaveAttempted] = useState(false)

  // A track is "ready" only with all required details: principal + rate + term (months).
  const trackMissing = (d: (typeof tracks)[number]) => {
    const m: string[] = []
    if ((parseFloat(d.principal) || 0) <= 0) m.push('סכום')
    if (trackEffectiveRate(d) <= 0) m.push('ריבית')
    if (!d.term_months) m.push('תקופה')
    return m
  }
  const trackReady = (d: (typeof tracks)[number]) => trackMissing(d).length === 0
  const effectiveTracks = tracks.map((t, i) => (i === editingIdx ? trackForm : t))
  const incompleteTracks = effectiveTracks.filter(t => !trackReady(t))

  // Save + collapse the open track when ready, otherwise flag exactly what's missing.
  const finalizeTrack = (i: number) => {
    if (trackReady(trackForm)) { saveTrackEdit(i); setSaveAttempted(false) }
    else { setSaveAttempted(true); setAlertPulse(p => p + 1) }
  }

  // On arrival a track is always opened for review (never lands collapsed from upload).
  useEffect(() => {
    if (editingIdx !== null) {
      if (tracks[editingIdx]) setTrackForm({ ...tracks[editingIdx] })
      return
    }
    if (showTrackForm) return
    if (tracks.length > 0) {
      setEditingIdx(0)
      setTrackForm({ ...tracks[0] })
      setGraceOn((parseInt(tracks[0].grace_months) || 0) > 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (incompleteTracks.length > 0) { setContinuePrompt(true); return }
      if (editingIdx !== null && trackReady(trackForm)) saveTrackEdit(editingIdx)
      setLoanForm(emptyLoan(keyDeliveryDate || undefined))
      advance('loans')
    }}>
      <StepHeader current="mortgage" icon={<Bank size={44} color="var(--accent)" />} title="משכנתא" />
      <FillExampleTop onFill={fillTestMortgage} />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

      <div className="onboarding-ai-fill">
        <button type="button" className={`btn-onboard-ai${mortgageAiDone && !mortgageAiBusy ? ' is-done' : ''}`} disabled={mortgageAiBusy}
          onClick={() => { if (mortgageAiBusy) return; mortgageDocFiles.length ? setShowDocs(o => !o) : mortgageDocRef.current?.click() }}
          aria-expanded={mortgageDocFiles.length ? showDocs : undefined}>
          {mortgageAiBusy
            ? 'קורא את המסמך…'
            : mortgageDocFiles.length
              ? <>📎 {mortgageDocFiles.length} {mortgageDocFiles.length === 1 ? 'קובץ הועלה' : 'קבצים הועלו'} — הקישו לצפייה <CaretDown size={15} weight="bold" className={`onboarding-ai-caret${showDocs ? ' is-open' : ''}`} /></>
              : '📄 העלו אישור מהבנק או צילומי מסך — מילוי אוטומטי'}
        </button>
        <input ref={mortgageDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) aiFillMortgage(fs); e.target.value = '' }} />
        {showDocs && <DocFileList files={mortgageDocFiles} onFiles={aiFillMortgage} onRemove={i => removeDocFile('mortgage', i)} onRename={(i, name) => renameDocFile('mortgage', i, name)} />}
        {mortgageAiErr && <p className="onboarding-error" role="alert">{mortgageAiErr}</p>}
        <p className="onboarding-subtitle onboarding-optional" style={{ marginTop: 6 }}>אפשר לבחור כמה צילומי מסך יחד · או הזינו ידנית למטה</p>
      </div>

      {/* Grace bar — one shared period; toggle on applies to all tracks, then mark per track */}
      {tracks.length > 0 && (
        <div className="onboarding-grace-bar">
          <label className="onboarding-grace-toggle">
            <input type="checkbox" checked={anyGrace}
              onChange={e => applyGraceToAllTracks(e.target.checked ? (graceMonths || '12') : '0')} />
            <span>גרייס — תשלום ריבית בלבד בהתחלה</span>
          </label>
          {anyGrace && (
            <div className="onboarding-grace-period">
              <span>תקופה</span>
              <input type="number" min="1" max="60" value={graceMonths}
                onChange={e => { setGraceMonths(e.target.value); setGraceMonthsForActive(e.target.value) }} />
              <span>ח׳</span>
            </div>
          )}
          {anyGrace && <p className="onboarding-field-hint" style={{ margin: '4px 0 0' }}>סמנו ליד כל מסלול אם הגרייס חל עליו</p>}
        </div>
      )}

      {/* Saved tracks list — click header to toggle edit in-place */}
      {tracks.length > 0 && (
        <div className="onboarding-list">
          {tracks.map((d, i) => {
            const monthly = trackMonthlyPayment(d)
            const graceMonthly = (parseInt(d.grace_months) || 0) > 0
              ? (parseFloat(d.principal) || 0) * (trackEffectiveRate(d) / 100 / 12)
              : 0
            const isEditing = editingIdx === i
            const view = isEditing ? trackForm : d
            const missing = trackMissing(view)
            return (
              <div key={i} className="onboarding-list-row onboarding-list-row--expandable">
                <div className="onboarding-list-row-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (isEditing) finalizeTrack(i)            // tap top = save + collapse (alert if incomplete)
                    else {
                      setEditingIdx(i)
                      setTrackForm({ ...d })
                      setGraceOn((parseInt(d.grace_months) || 0) > 0)
                      setShowTrackForm(false)
                      setSaveAttempted(false)
                    }
                  }}>
                  <div className="onboarding-track-summary">
                    <div className="onboarding-track-summary-top">
                      <span className="onboarding-list-row-type">{trackTypeLabel(d.track_type)}</span>
                      <span className="onboarding-track-payment">
                        {graceMonthly > 0
                          ? <>{formatCurrency(graceMonthly)} <span className="text-muted">/ {formatCurrency(monthly)}</span></>
                          : formatCurrency(monthly)
                        }
                        <span className="text-muted"> / חודש</span>
                      </span>
                    </div>
                    <div className="onboarding-track-summary-sub">
                      <span>קרן {formatCurrency(parseFloat(d.principal) || 0)}</span>
                      <span>·</span>
                      <span>{trackEffectiveRate(d).toFixed(2)}%</span>
                      <span>·</span>
                      <span>{d.term_months} ח׳</span>
                      {(parseInt(d.grace_months) || 0) > 0 && <><span>·</span><span>גרייס {d.grace_months} ח׳</span></>}
                    </div>
                    {missing.length > 0 && (
                      <div className="onboarding-track-missing onboarding-track-missing--flash"
                        key={isEditing ? `m-${i}-${alertPulse}` : `m-${i}`}>
                        חסר {missing.join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="onboarding-list-row-actions">
                    {anyGrace && (
                      <label className="onboarding-track-grace" onClick={e => e.stopPropagation()} title="גרייס למסלול זה">
                        <input type="checkbox" checked={(parseInt(d.grace_months) || 0) > 0}
                          onChange={e => setTrackGraceMonths(i, e.target.checked ? (graceMonths || '12') : '0')} />
                        <span>גרייס</span>
                      </label>
                    )}
                    <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); removeTrack(i) }} aria-label="מחיקה" title="מחיקה"><X size={16} /></button>
                  </div>
                </div>
                {isEditing && <TrackForm
                  onSave={() => finalizeTrack(i)}
                  onCancel={() => { setEditingIdx(null); setSaveAttempted(false) }}
                  alert={saveAttempted ? trackMissing(trackForm) : null} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Inline track form for new track */}
      {showTrackForm && <TrackForm onSave={addTrack} onCancel={() => setShowTrackForm(false)} />}

      {/* Add track button — always shown */}
      <button type="button" className="btn-onboard-skip onboarding-add-btn"
        style={{ marginBottom: 16 }}
        onClick={() => {
          if (showTrackForm || editingIdx !== null) {
            saveCurrentAndOpenNew()
          } else {
            setTrackForm(emptyTrack(keyDeliveryDate || undefined))
            setGraceOn(false)
            setShowTrackForm(true)
            setEditingIdx(null)
          }
        }}>
        + הוסף מסלול
      </button>

      {/* Conclusion totals */}
      {tracks.length > 0 && (
        <div className="onboarding-mortgage-summary">
          <div className="onboarding-list-total">
            <span>סה״כ קרן</span>
            <strong>{formatCurrency(totalPrincipal)}</strong>
          </div>
          {hasAnyGrace && totalGraceMonthly > 0 && (
            <div className="onboarding-list-total">
              <span>תשלום חודשי בגרייס</span>
              <strong>{formatCurrency(totalGraceMonthly)}</strong>
            </div>
          )}
          {totalMonthly > 0 && (
            <div className="onboarding-list-total">
              <span>{hasAnyGrace ? 'תשלום חודשי לאחר גרייס' : 'תשלום חודשי'}</span>
              <strong>{formatCurrency(totalMonthly)}</strong>
            </div>
          )}
        </div>
      )}

      <button type="submit" className="btn-onboard-primary onboarding-cta-full">הבא</button>
      <FinishEarly />

      {continuePrompt && createPortal(
        <div className="onboarding-dialog-overlay" onClick={() => setContinuePrompt(false)}>
          <div className="onboarding-dialog" onClick={e => e.stopPropagation()}>
            <div className="onboarding-dialog-title">חסרים פרטים במסלול</div>
            <p className="onboarding-dialog-lead">אם תמשיכו, המסלול הזה לא יישמר:</p>
            <ul className="onboarding-dialog-list">
              {incompleteTracks.map((t, idx) => (
                <li key={idx}>
                  <strong>{trackTypeLabel(t.track_type)}</strong> — חסר {trackMissing(t).join(', ')}
                </li>
              ))}
            </ul>
            <div className="onboarding-dialog-actions">
              <button type="button" className="btn-onboard-primary onboarding-cta-full" onClick={() => {
                const idx = tracks.findIndex(t => !trackReady(t))
                setContinuePrompt(false)
                if (idx >= 0) {
                  setEditingIdx(idx)
                  setTrackForm({ ...tracks[idx] })
                  setGraceOn((parseInt(tracks[idx].grace_months) || 0) > 0)
                  setShowTrackForm(false)
                }
              }}>חזרה להשלמה</button>
              <button type="button" className="btn-onboard-skip onboarding-cta-full" onClick={() => {
                setTracks(prev => prev.filter(trackReady))
                setEditingIdx(null)
                setContinuePrompt(false)
                setLoanForm(emptyLoan(keyDeliveryDate || undefined))
                advance('loans')
              }}>המשך בלי לשמור</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </form>
  )
}
