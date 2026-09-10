import { useId, useRef, useState, useEffect } from 'react'
import { sanitizeAmountInt, todayISO, formatCurrency } from '../../lib/format'
import { useAuth } from '../../contexts/AuthContext'
import { buildPlan, savePlan, clearPlan } from '../../lib/purchasePlan'
import { purchaseTax } from '../../lib/purchaseTax'
import { Tag, CaretDown } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { DocFileList } from './DocFileList'
import { emptyTrack, formatPrice } from './types'
import { purchaseWarnings } from './validation'
import { useOnboarding } from './context'
import { DateField } from '../ui/DateField'

export function PurchaseStep() {
  // Real labels: a <label> that neither carries htmlFor nor wraps its control is
  // decorative text — a screen reader announces an unnamed edit box and tapping it does
  // not focus the field. useId keeps the pairing unique even if the step ever renders twice.
  const uid = useId()
  const {
    advance, setTrackForm, keyDeliveryDate,
    buyerName, setBuyerName, street, setStreet, city, setCity,
    rooms, setRooms, purchasePrice, setPurchasePrice,
    signingDate, setSigningDate, setKeyDeliveryDate,
    propertySizeSqm, setPropertySizeSqm, floorNumber, setFloorNumber,
    purchaseAiBusy, purchaseAiErr, purchaseAiDone, aiFillPurchase,
    docAttachments, removeDocFile, renameDocFile,
    fillTestPurchase,
  } = useOnboarding()
  const { user } = useAuth()
  const purchaseDocRef = useRef<HTMLInputElement>(null)

  // ── תנאי התשלום ──────────────────────────────────────────────────────────────
  // The owner (10.09): "ההקמה אמורה לקרות בעיקר באונבורדינג". The payment terms belong on
  // this step and nowhere else — the price and both dates are already here, and asking for
  // percentages beside them costs one block instead of a tenth wizard step.
  //
  // It appears only for someone whose key is still ahead: an owner who already has the flat
  // has no plan to build, and a question he cannot answer is worse than no question.
  const [firstPct, setFirstPct] = useState(10)
  const [secondPct, setSecondPct] = useState(15)
  const [singleApartment, setSingleApartment] = useState(true)
  const price = Number(purchasePrice) || 0
  const awaitingKey = !!keyDeliveryDate && keyDeliveryDate > todayISO()
  const showTerms = awaitingKey && price > 0
  // Every statutory deadline in the plan is measured from the SIGNING date — report within
  // 30 days, pay within 60. `signingDate || todayISO()` silently anchored them to the day
  // he installed instead: someone who signed two months ago and skipped the field was told
  // his tax report was due in a month, when he was already a month late. The app may not
  // invent the one date its legal deadlines hang on. Without it, no plan and no deadline.
  const canPlan = showTerms && !!signingDate

  // The plan IS the persistence — no extra draft field to keep in sync, and it is rebuilt
  // at finish once the costs are known (useOnboardingState).
  useEffect(() => {
    if (!user?.id) return
    if (!canPlan) { clearPlan(user.id); return }
    savePlan(user.id, buildPlan({
      price,
      signing: signingDate,
      handover: keyDeliveryDate!,
      firstPct, secondPct, singleApartment,
    }))
  }, [user?.id, canPlan, price, signingDate, keyDeliveryDate, firstPct, secondPct, singleApartment])
  const [showDocs, setShowDocs] = useState(false)
  // Drive the banner/toggle from the SAME source as the list below: files already in
  // storage count too, otherwise after a reload the list knew about the document while
  // this header still said "upload one" (owner: uploaded a rental contract up front,
  // then the rental step showed nothing).
  const docs = docAttachments('purchase')

  // Live plausibility hints — everything here is optional, so nothing blocks;
  // a thousands-slip price or an inverted signing/key-delivery pair just asks.
  const warnings = purchaseWarnings({ purchasePrice, signingDate, keyDeliveryDate })

  return (
    <form onSubmit={e => {
      e.preventDefault()
      setTrackForm(emptyTrack(keyDeliveryDate || undefined))
      advance('mortgage')
    }} noValidate>
      <StepHeader current="purchase" icon={<Tag size={44} color="var(--accent)" />} title="פרטי רכישה" />
      <FillExampleTop onFill={fillTestPurchase} />

      <div className="onboarding-ai-fill">
        <button type="button" className={`btn-onboard-ai${purchaseAiDone && !purchaseAiBusy ? ' is-done' : ''}`} disabled={purchaseAiBusy}
          onClick={() => { if (purchaseAiBusy) return; docs.length ? setShowDocs(o => !o) : purchaseDocRef.current?.click() }}
          aria-expanded={docs.length ? showDocs : undefined}>
          {purchaseAiBusy
            ? 'קורא את החוזה…'
            : docs.length
              ? <>📎 {docs.length} {docs.length === 1 ? 'קובץ הועלה' : 'קבצים הועלו'} — הקישו לצפייה <CaretDown size={15} weight="bold" className={`onboarding-ai-caret${showDocs ? ' is-open' : ''}`} /></>
              : '📄 העלו חוזה רכישה — מילוי אוטומטי'}
        </button>
        <input ref={purchaseDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) aiFillPurchase(fs); e.target.value = '' }} />
        {showDocs && <DocFileList files={docs} onFiles={aiFillPurchase} onRemove={name => removeDocFile('purchase', name)} onRename={(oldName, name) => renameDocFile('purchase', oldName, name)} />}
        {purchaseAiErr && <p className="onboarding-error" role="alert">{purchaseAiErr}</p>}
        <p className="onboarding-subtitle onboarding-optional" style={{ marginTop: 6 }}>אפשר כמה צילומי מסך יחד · או מלאו ידנית למטה</p>
      </div>

      <div className="onboarding-form">
        <div className="onboarding-field">
          <label htmlFor={`${uid}-buyer`}>שם הרוכש</label>
          <input id={`${uid}-buyer`} type="text" placeholder="שם מלא" value={buyerName}
            onChange={e => setBuyerName(e.target.value)} />
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label htmlFor={`${uid}-street`}>רחוב</label>
            <input id={`${uid}-street`} type="text" placeholder="רחוב ומספר" value={street}
              onChange={e => setStreet(e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label htmlFor={`${uid}-city`}>עיר</label>
            <input id={`${uid}-city`} type="text" placeholder="עיר" value={city}
              onChange={e => setCity(e.target.value)} />
          </div>
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label htmlFor={`${uid}-sqm`}>שטח (מ&quot;ר)</label>
            <input id={`${uid}-sqm`} type="number" placeholder="0" min="0" value={propertySizeSqm}
              onChange={e => setPropertySizeSqm(e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label htmlFor={`${uid}-floor`}>קומה</label>
            <input id={`${uid}-floor`} type="number" placeholder="0" value={floorNumber}
              onChange={e => setFloorNumber(e.target.value)} />
          </div>
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label htmlFor={`${uid}-rooms`}>מספר חדרים</label>
            <input id={`${uid}-rooms`} type="number" placeholder="0" min="0" step="0.5" value={rooms}
              onChange={e => setRooms(e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label htmlFor={`${uid}-price`}>מחיר רכישה (₪)</label>
            <input id={`${uid}-price`} type="text" inputMode="numeric" placeholder="0"
              value={formatPrice(purchasePrice)}
              onChange={e => setPurchasePrice(sanitizeAmountInt(e.target.value))} />
          </div>
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>תאריך חתימת חוזה</label>
            <DateField value={signingDate} onChange={setSigningDate} ariaLabel="תאריך חתימת חוזה" />
          </div>
          <div className="onboarding-field">
            <label>מסירת מפתח</label>
            <DateField value={keyDeliveryDate} onChange={setKeyDeliveryDate} ariaLabel="מסירת מפתח" />
            {/* The whole pre-key experience hangs on this one optional field in the
                middle of a long form: fill it with a future date and the app switches to
                the waiting period; leave it blank and nothing changes. Say so, or the
                people it was built for will never see it. */}
            <span className="onboarding-field-hint">
              {keyDeliveryDate && keyDeliveryDate > todayISO()
                ? 'המפתח עוד לא אצלכם — האפליקציה תתאים את עצמה לתקופת ההמתנה'
                : 'עוד לא קיבלתם את המפתח? מלאו את התאריך הצפוי'}
            </span>
          </div>
        </div>
      </div>

      {showTerms && (
        <div className="onboarding-terms">
          <div className="onboarding-terms-head">
            <h3>תנאי התשלום בחוזה</h3>
            <span>האחוזים ממך — הסכומים מאיתנו</span>
          </div>

          <div className="onboarding-terms-chips">
            {([[10, 15], [15, 10], [10, 10], [20, 0]] as [number, number][]).map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                type="button"
                className={`onboarding-terms-chip${firstPct === a && secondPct === b ? ' on' : ''}`}
                onClick={() => { setFirstPct(a); setSecondPct(b) }}
              >
                {b > 0 ? `${a}% ואז ${b}%` : `${a}% בלבד`}
              </button>
            ))}
          </div>

          <div className="onboarding-terms-rows">
            <div><span>בחתימה</span><b>{formatCurrency(Math.round(price * firstPct / 100))}</b></div>
            {secondPct > 0 && <div><span>תשלום שני</span><b>{formatCurrency(Math.round(price * secondPct / 100))}</b></div>}
            <div className="muted">
              <span>משכנתא במסירה · {Math.max(0, 100 - firstPct - secondPct)}%</span>
              <b>{formatCurrency(Math.round(price * Math.max(0, 100 - firstPct - secondPct) / 100))}</b>
            </div>
          </div>

          <div className="onboarding-terms-tax">
            <div className="onboarding-terms-chips">
              <button type="button" className={`onboarding-terms-chip${singleApartment ? ' on' : ''}`} onClick={() => setSingleApartment(true)}>דירה יחידה</button>
              <button type="button" className={`onboarding-terms-chip${!singleApartment ? ' on' : ''}`} onClick={() => setSingleApartment(false)}>דירה נוספת</button>
            </div>
            {/* The amount depends only on the price and the declaration, so it is honest
                either way. The DEADLINE hangs on the signing date — so it is only stated
                once that date exists, and its absence is named instead of papered over. */}
            <span>
              מס רכישה <b>{formatCurrency(purchaseTax(price, singleApartment))}</b>
              {signingDate
                ? <>{' · '}לתשלום עד 60 יום מהחתימה</>
                : <>{' · '}<em>מלאו תאריך חתימה כדי לחשב את המועדים</em></>}
            </span>
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="onboarding-soft-warning" style={{ marginBottom: 10 }}>
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
      <button type="submit" className="btn-onboard-primary onboarding-cta-full">המשך</button>
    </form>
  )
}
