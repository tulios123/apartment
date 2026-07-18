import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bank, X, CaretDown, Sparkle } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { TrackForm } from './TrackForm'
import { FinishEarly } from './FinishEarly'
import { DocFileList } from './DocFileList'
import { emptyTrack, emptyLoan, formatCurrency } from './types'
import { issueText } from './validation'
import { formatDate } from '../../lib/format'
import { useOnboarding } from './context'

export function MortgageStep() {
  const {
    advance, keyDeliveryDate, setLoanForm,
    mortgageAiBusy, mortgageDocRef, mortgageAiErr, mortgageAiDone, aiFillMortgage,
    mortgageDocFiles, removeDocFile, renameDocFile,
    tracks, setTracks, trackForm, trackMonthlyPayment, trackEffectiveRate, trackTypeLabel,
    trackIssues, trackDraftHasData,
    editingIdx, setEditingIdx, setTrackForm, setGraceOn, showTrackForm, setShowTrackForm,
    addTrack, saveTrackEdit, saveCurrentAndOpenNew, removeTrack,
    setTrackGraceMonths, applyGraceToAllTracks, setGraceMonthsForActive,
    totalPrincipal, totalMonthly, hasAnyGrace, totalGraceMonthly,
    effectiveTrackForm,
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
  // The "detected from document" banner is only accurate for the untouched scan
  // result — hide it once the user manually adds or removes a track.
  const [scanBannerOff, setScanBannerOff] = useState(false)

  // A track is "ready" only with all required details: principal + rate + term (months).
  // The bar is the SHARED gate (./validation) — the same one the finish path enforces.
  const trackReady = (d: (typeof tracks)[number]) => trackIssues(d).length === 0
  const effectiveTracks = tracks.map((t, i) => (i === editingIdx ? trackForm : t))
  const incompleteTracks = effectiveTracks.filter(t => !trackReady(t))

  // A brand-new track typed into the inline form but not yet saved to the list — it
  // isn't in `tracks`, so without this it would be silently dropped on "המשך".
  // RAW typed fields only: the previous check counted the grey-placeholder rate
  // default, so an untouched empty form always "had data" and raised the dialog.
  const pendingNew = showTrackForm && editingIdx === null && trackDraftHasData(trackForm)
  const pendingNewReady = pendingNew && trackReady(trackForm)
  const unsavedTracks = pendingNew && !trackReady(trackForm) ? [...incompleteTracks, trackForm] : incompleteTracks

  // Save + collapse the open track when ready, otherwise flag exactly what's missing.
  const finalizeTrack = (i: number) => {
    if (trackReady(trackForm)) { saveTrackEdit(i); setSaveAttempted(false) }
    else { setSaveAttempted(true); setAlertPulse(p => p + 1) }
  }

  // Saving a NEW track validates the EFFECTIVE draft (grey defaults count as real
  // values here — they're saved as shown), so an untouched field is fine but a
  // typed 0 principal/term raises the alert instead of silently doing nothing.
  const newTrackIssues = trackIssues(effectiveTrackForm)
  const finalizeNewTrack = () => {
    if (newTrackIssues.length === 0) { addTrack(); setSaveAttempted(false) }
    else { setSaveAttempted(true); setAlertPulse(p => p + 1) }
  }

  // On arrival, tracks land as collapsed REVIEW cards (a banner + each card's details
  // and "חסר X" badge) instead of auto-opening one in edit mode — which appeared as a
  // form popping up with no context after a scan (user feedback). Tap a card to edit.
  // Still sync the form if we arrived mid-edit (e.g. from the "complete it" prompt).
  useEffect(() => {
    if (editingIdx !== null && tracks[editingIdx]) setTrackForm({ ...tracks[editingIdx] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc closes the "missing details" confirm dialog (mirrors the app Modal — UX-05).
  useEffect(() => {
    if (!continuePrompt) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContinuePrompt(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [continuePrompt])

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (pendingNewReady) addTrack()   // auto-save a fully-filled new track instead of dropping it
      if (unsavedTracks.length > 0) { setContinuePrompt(true); return }
      if (editingIdx !== null && trackReady(trackForm)) saveTrackEdit(editingIdx)
      setLoanForm(emptyLoan(keyDeliveryDate || undefined))
      advance('loans')
    }} noValidate>
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
              <input type="number" min="1" max="60" aria-label="תקופת גרייס בחודשים" value={graceMonths}
                onChange={e => { setGraceMonths(e.target.value); setGraceMonthsForActive(e.target.value) }} />
              <span>ח׳</span>
            </div>
          )}
          {anyGrace && <p className="onboarding-field-hint" style={{ margin: '4px 0 0' }}>סמנו ליד כל מסלול אם הגרייס חל עליו</p>}
        </div>
      )}

      {/* Scan result banner — makes it clear the tracks below came from the document. */}
      {mortgageAiDone && !scanBannerOff && tracks.length > 0 && editingIdx === null && !showTrackForm && (
        <div className="onboarding-scan-banner">
          <Sparkle size={15} weight="fill" />
          זוהו {tracks.length} {tracks.length === 1 ? 'מסלול' : 'מסלולים'} מהמסמך — בדקו, והקישו על מסלול לעריכה
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
            const issues = trackIssues(view)
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
                      <span>·</span>
                      {d.start_date
                        ? <span>החל {formatDate(d.start_date)}</span>
                        : <span className="text-muted">תאריך התחלה אוטומטי</span>}
                    </div>
                    {issues.length > 0 && (
                      <div className="onboarding-track-missing onboarding-track-missing--flash"
                        key={isEditing ? `m-${i}-${alertPulse}` : `m-${i}`}>
                        {issueText(issues)}
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
                    <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); setScanBannerOff(true); removeTrack(i) }} aria-label="מחיקה" title="מחיקה"><X size={16} /></button>
                  </div>
                </div>
                {isEditing && <TrackForm
                  onSave={() => finalizeTrack(i)}
                  onCancel={() => { setEditingIdx(null); setSaveAttempted(false) }}
                  alert={saveAttempted ? trackIssues(trackForm) : null} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Inline track form for new track */}
      {showTrackForm && <TrackForm onSave={finalizeNewTrack}
        onCancel={() => { setShowTrackForm(false); setSaveAttempted(false) }}
        alert={saveAttempted && editingIdx === null ? newTrackIssues : null} />}

      {/* Add track button — always shown */}
      <button type="button" className="btn-onboard-skip onboarding-add-btn"
        style={{ marginBottom: 16 }}
        onClick={() => {
          setScanBannerOff(true)
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

      <button type="submit" className="btn-onboard-primary onboarding-cta-full">המשך</button>
      <FinishEarly />

      {continuePrompt && createPortal(
        <div className="onboarding-dialog-overlay" onClick={() => setContinuePrompt(false)}>
          <div className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-dialog-title" onClick={e => e.stopPropagation()}>
            <div className="onboarding-dialog-title" id="onboarding-dialog-title">חסרים פרטים במסלול</div>
            <p className="onboarding-dialog-lead">אם תמשיכו, המסלול הזה לא יישמר:</p>
            <ul className="onboarding-dialog-list">
              {unsavedTracks.map((t, idx) => (
                <li key={idx}>
                  <strong>{trackTypeLabel(t.track_type)}</strong> — {issueText(trackIssues(t))}
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
                setShowTrackForm(false)   // discard the unsaved new-track form too
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
